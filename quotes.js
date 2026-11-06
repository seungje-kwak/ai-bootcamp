// 명언을 추가하거나 고치려면 아래 배열에 { text, author } 를 넣으면 됩니다.
const quotes = [
    { text: "천재는 1%의 영감과 99%의 노력으로 이루어진다.", author: "토머스 에디슨" },
    { text: "시작이 반이다.", author: "아리스토텔레스" },
    { text: "할 수 있다고 믿든 할 수 없다고 믿든, 믿는 대로 된다.", author: "헨리 포드" },
    { text: "오늘 할 수 있는 일을 내일로 미루지 마라.", author: "벤저민 프랭클린" },
    { text: "배움에는 왕도가 없다.", author: "유클리드" },
    { text: "가장 어두운 밤도 끝나고 아침은 온다.", author: "빅토르 위고" },
    { text: "천천히 가도 된다. 멈추지만 않으면 된다.", author: "공자" },
    { text: "실패는 성공으로 가는 과정일 뿐이다.", author: "속담" }
];

const quoteElement = document.getElementById("quote");
const authorElement = document.getElementById("author");
const quotePanel = document.querySelector(".quote-panel");
const nextButton = document.getElementById("next-quote");
const copyButton = document.getElementById("copy-quote");
const copyStatus = document.getElementById("copy-status");

let currentIndex = -1;
let statusTimer = null;

function pickRandomIndex() {
    if (quotes.length === 1) {
        return 0;
    }

    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
        nextIndex = Math.floor(Math.random() * quotes.length);
    }
    return nextIndex;
}

function renderQuote(index) {
    currentIndex = index;
    quoteElement.textContent = quotes[index].text;
    authorElement.textContent = quotes[index].author;
}

function showNextQuote() {
    const nextIndex = pickRandomIndex();
    quotePanel.classList.add("is-changing");

    window.setTimeout(function () {
        renderQuote(nextIndex);
        quotePanel.classList.remove("is-changing");
        copyStatus.textContent = "";
    }, 280);
}

function quoteToCopy() {
    return "“" + quoteElement.textContent + "” — " + authorElement.textContent;
}

function showCopied() {
    copyStatus.textContent = "명언을 복사했습니다.";
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () {
        copyStatus.textContent = "";
    }, 1800);
}

function copyWithTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
}

function copyQuote() {
    const text = quoteToCopy();

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(showCopied).catch(function () {
            if (copyWithTextarea(text)) {
                showCopied();
            }
        });
        return;
    }

    if (copyWithTextarea(text)) {
        showCopied();
    }
}

nextButton.addEventListener("click", showNextQuote);
copyButton.addEventListener("click", copyQuote);
renderQuote(pickRandomIndex());
