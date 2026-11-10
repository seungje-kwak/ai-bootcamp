"""장바구니 API.

화면(브라우저)은 처음 방문할 때 cart_id(UUID)를 하나 만들어 저장해 두고,
이후 모든 장바구니 요청에 그 cart_id를 붙여 보낸다.
가격과 합계는 항상 서버가 Supabase의 상품 가격으로 계산한다 (화면이 보낸 가격은 믿지 않음).

속도를 위해 Supabase 왕복을 최소로 줄였다.
- 상품 목록은 자주 바뀌지 않으므로 서버 메모리에 잠깐(PRODUCT_CACHE_SECONDS) 보관한다.
- 장바구니를 바꾸는 요청은 "읽기 1번 + 쓰기 1번"만 하고, 결과 장바구니는 서버에서 계산해 돌려준다.
"""
import time
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

FREE_SHIPPING_FROM = 50000  # 이 금액 이상이면 무료 배송
SHIPPING_FEE = 3000
PRODUCT_FIELDS = "id, name, description, price, emoji, category"
PRODUCT_CACHE_SECONDS = 60


class AddItemIn(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class UpdateItemIn(BaseModel):
    quantity: int = Field(ge=1, le=99)


def create_router(sb) -> APIRouter:
    router = APIRouter(tags=["cart"])
    cache = {"at": 0.0, "list": [], "by_id": {}}

    # ---------- 상품 (메모리 캐시) ----------
    def products(force: bool = False) -> dict:
        if force or time.monotonic() - cache["at"] > PRODUCT_CACHE_SECONDS:
            rows = sb.table("products").select(PRODUCT_FIELDS).order("id").execute().data
            cache.update(at=time.monotonic(), list=rows, by_id={p["id"]: p for p in rows})
        return cache["by_id"]

    def product_or_404(product_id: int) -> dict:
        p = products().get(product_id)
        if p is None:  # 방금 추가된 상품일 수 있으니 한 번만 새로 읽어 본다
            p = products(force=True).get(product_id)
        if p is None:
            raise HTTPException(status_code=404, detail="없는 상품입니다.")
        return p

    # ---------- 장바구니 ----------
    def fetch_rows(cart_id: UUID) -> list:
        """Supabase에서 이 장바구니의 줄들을 읽는다 (왕복 1번)."""
        return (
            sb.table("cart_items")
            .select("id, product_id, quantity")
            .eq("cart_id", str(cart_id))
            .order("created_at")
            .execute()
            .data
        )

    def build_cart(cart_id: UUID, rows: list) -> dict:
        """줄 목록 + 상품 캐시로 화면에 보낼 장바구니를 계산한다 (왕복 없음)."""
        by_id = products()
        if any(r["product_id"] not in by_id for r in rows):
            by_id = products(force=True)
        items = []
        for r in rows:
            p = by_id.get(r["product_id"])
            if p is None:  # 상품이 삭제된 경우
                continue
            items.append({
                "id": r["id"],
                "quantity": r["quantity"],
                "product": p,
                "subtotal": p["price"] * r["quantity"],
            })
        item_total = sum(i["subtotal"] for i in items)
        shipping = 0 if item_total == 0 or item_total >= FREE_SHIPPING_FROM else SHIPPING_FEE
        return {
            "cart_id": str(cart_id),
            "items": items,
            "count": sum(i["quantity"] for i in items),
            "item_total": item_total,
            "shipping": shipping,
            "total": item_total + shipping,
            "free_shipping_from": FREE_SHIPPING_FROM,
        }

    def replace_row(rows: list, item_id: int, new_row: dict | None) -> list:
        out = []
        for r in rows:
            if r["id"] == item_id:
                if new_row is not None:
                    out.append({**r, **new_row})
            else:
                out.append(r)
        return out

    @router.get("/products")
    def list_products():
        products()
        return cache["list"]

    @router.get("/cart/{cart_id}")
    def get_cart(cart_id: UUID):
        return build_cart(cart_id, fetch_rows(cart_id))

    @router.post("/cart/{cart_id}/items", status_code=201)
    def add_item(cart_id: UUID, body: AddItemIn):
        product_or_404(body.product_id)
        rows = fetch_rows(cart_id)                                   # 왕복 1
        existing = next((r for r in rows if r["product_id"] == body.product_id), None)
        if existing:
            new_qty = min(99, existing["quantity"] + body.quantity)
            sb.table("cart_items").update({"quantity": new_qty}).eq("id", existing["id"]).execute()  # 왕복 2
            rows = replace_row(rows, existing["id"], {"quantity": new_qty})
        else:
            try:
                row = sb.table("cart_items").insert({                # 왕복 2
                    "cart_id": str(cart_id),
                    "product_id": body.product_id,
                    "quantity": body.quantity,
                }).execute().data[0]
            except Exception as e:
                # 버튼을 빠르게 두 번 눌러 같은 상품이 동시에 들어온 경우 (unique 충돌)
                if "23505" not in str(e):
                    raise
                return add_item(cart_id, body)
            rows.append({"id": row["id"], "product_id": row["product_id"], "quantity": row["quantity"]})
        return build_cart(cart_id, rows)

    @router.patch("/cart/{cart_id}/items/{item_id}")
    def update_item(cart_id: UUID, item_id: int, body: UpdateItemIn):
        updated = (                                                  # 왕복 1 (내 장바구니의 줄만 바뀜)
            sb.table("cart_items").update({"quantity": body.quantity})
            .eq("cart_id", str(cart_id)).eq("id", item_id).execute().data
        )
        if not updated:
            raise HTTPException(status_code=404, detail="장바구니에 해당 상품이 없습니다.")
        return get_cart(cart_id)                                     # 왕복 2

    @router.delete("/cart/{cart_id}/items/{item_id}")
    def remove_item(cart_id: UUID, item_id: int):
        deleted = (                                                  # 왕복 1
            sb.table("cart_items").delete()
            .eq("cart_id", str(cart_id)).eq("id", item_id).execute().data
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="장바구니에 해당 상품이 없습니다.")
        return get_cart(cart_id)                                     # 왕복 2

    @router.delete("/cart/{cart_id}")
    def clear_cart(cart_id: UUID):
        sb.table("cart_items").delete().eq("cart_id", str(cart_id)).execute()  # 왕복 1
        return build_cart(cart_id, [])

    @router.post("/cart/{cart_id}/checkout", status_code=201)
    def checkout(cart_id: UUID):
        cart = get_cart(cart_id)                                     # 왕복 1
        if not cart["items"]:
            raise HTTPException(status_code=400, detail="장바구니가 비어 있습니다.")
        order = sb.table("orders").insert({                          # 왕복 2
            "cart_id": str(cart_id),
            "items": [
                {"product_id": i["product"]["id"], "name": i["product"]["name"],
                 "price": i["product"]["price"], "quantity": i["quantity"]}
                for i in cart["items"]
            ],
            "item_total": cart["item_total"],
            "shipping": cart["shipping"],
            "total": cart["total"],
        }).execute().data[0]
        ids = [i["id"] for i in cart["items"]]                       # 주문에 들어간 줄만 지움
        sb.table("cart_items").delete().in_("id", ids).execute()     # 왕복 3
        return order

    return router
