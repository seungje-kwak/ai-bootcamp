"""장바구니 API.

화면(브라우저)은 처음 방문할 때 cart_id(UUID)를 하나 만들어 저장해 두고,
이후 모든 장바구니 요청에 그 cart_id를 붙여 보낸다.
가격과 합계는 항상 서버가 Supabase의 상품 가격으로 계산한다 (화면이 보낸 가격은 믿지 않음).
"""
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

FREE_SHIPPING_FROM = 50000  # 이 금액 이상이면 무료 배송
SHIPPING_FEE = 3000
PRODUCT_FIELDS = "id, name, description, price, emoji, category"


class AddItemIn(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class UpdateItemIn(BaseModel):
    quantity: int = Field(ge=1, le=99)


def create_router(sb) -> APIRouter:
    router = APIRouter(tags=["cart"])

    def load_cart(cart_id: UUID) -> dict:
        res = (
            sb.table("cart_items")
            .select(f"id, quantity, product:products({PRODUCT_FIELDS})")
            .eq("cart_id", str(cart_id))
            .order("created_at")
            .execute()
        )
        items = []
        for row in res.data:
            product = row["product"]
            items.append({
                "id": row["id"],
                "quantity": row["quantity"],
                "product": product,
                "subtotal": product["price"] * row["quantity"],
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

    def find_item(cart_id: UUID, item_id: int) -> dict:
        res = (
            sb.table("cart_items").select("id, quantity")
            .eq("cart_id", str(cart_id)).eq("id", item_id).execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="장바구니에 해당 상품이 없습니다.")
        return res.data[0]

    @router.get("/products")
    def list_products():
        res = sb.table("products").select(PRODUCT_FIELDS).order("id").execute()
        return res.data

    @router.get("/cart/{cart_id}")
    def get_cart(cart_id: UUID):
        return load_cart(cart_id)

    @router.post("/cart/{cart_id}/items", status_code=201)
    def add_item(cart_id: UUID, body: AddItemIn):
        product = sb.table("products").select("id").eq("id", body.product_id).execute()
        if not product.data:
            raise HTTPException(status_code=404, detail="없는 상품입니다.")

        existing = (
            sb.table("cart_items").select("id, quantity")
            .eq("cart_id", str(cart_id)).eq("product_id", body.product_id).execute()
        )
        if existing.data:
            row = existing.data[0]
            new_qty = min(99, row["quantity"] + body.quantity)
            sb.table("cart_items").update({"quantity": new_qty}).eq("id", row["id"]).execute()
        else:
            sb.table("cart_items").insert({
                "cart_id": str(cart_id),
                "product_id": body.product_id,
                "quantity": body.quantity,
            }).execute()
        return load_cart(cart_id)

    @router.patch("/cart/{cart_id}/items/{item_id}")
    def update_item(cart_id: UUID, item_id: int, body: UpdateItemIn):
        find_item(cart_id, item_id)
        sb.table("cart_items").update({"quantity": body.quantity}).eq("id", item_id).execute()
        return load_cart(cart_id)

    @router.delete("/cart/{cart_id}/items/{item_id}")
    def remove_item(cart_id: UUID, item_id: int):
        find_item(cart_id, item_id)
        sb.table("cart_items").delete().eq("id", item_id).execute()
        return load_cart(cart_id)

    @router.delete("/cart/{cart_id}")
    def clear_cart(cart_id: UUID):
        sb.table("cart_items").delete().eq("cart_id", str(cart_id)).execute()
        return load_cart(cart_id)

    @router.post("/cart/{cart_id}/checkout", status_code=201)
    def checkout(cart_id: UUID):
        cart = load_cart(cart_id)
        if not cart["items"]:
            raise HTTPException(status_code=400, detail="장바구니가 비어 있습니다.")
        order = sb.table("orders").insert({
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
        sb.table("cart_items").delete().eq("cart_id", str(cart_id)).execute()
        return order

    return router
