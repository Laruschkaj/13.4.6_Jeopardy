const NUM_CATEGORIES = 6;
const NUM_QUESTIONS_PER_CAT = 5;
const API_BASE_URL = "https://projects.springboard.com/jeopardy/api";

let categories = [];

/** Get NUM_CATEGORIES random category from API. Returns array of category ids */
async function getCategoryIds() {
    const response = await axios.get(`${API_BASE_URL}/categories`, {
        params: { count: 100 }
    });
    const catIds = _.sampleSize(response.data, NUM_CATEGORIES).map(c => c.id);
    return catIds;
}

/** Return object with data about a category */
async function getCategory(catId) {
    const response = await axios.get(`${API_BASE_URL}/category`, {
        params: { id: catId }
    });
    const clues = _.sampleSize(response.data.clues, NUM_QUESTIONS_PER_CAT).map(clue => ({
        question: clue.question,
        answer: clue.answer,
        showing: null
    }));
    return { title: response.data.title, clues };
}

/** Fill the HTML table with categories & clues */
async function fillTable() {
    const $thead = $("thead").empty();
    const $tbody = $("tbody").empty();

    // Header row
    const $tr = $("<tr>");
    for (let cat of categories) {
        $tr.append($("<th>").text(cat.title));
    }
    $thead.append($tr);

    // Question rows
    for (let clueIdx = 0; clueIdx < NUM_QUESTIONS_PER_CAT; clueIdx++) {
        const $tr = $("<tr>");
        for (let catIdx = 0; catIdx < NUM_CATEGORIES; catIdx++) {
            const $td = $("<td>")
                .attr("id", `${catIdx}-${clueIdx}`)
                .text("?");
            $tr.append($td);
        }
        $tbody.append($tr);
    }
}

/** Handle click on a clue cell */
function handleClick(evt) {
    const id = evt.target.id;
    const [catIdx, clueIdx] = id.split("-").map(Number);
    const clue = categories[catIdx].clues[clueIdx];

    if (clue.showing === null) {
        $(`#${id}`).text(clue.question);
        clue.showing = "question";
    } else if (clue.showing === "question") {
        $(`#${id}`).text(clue.answer);
        clue.showing = "answer";
    }
}

/** Show loading spinner */
function showLoadingView() {
    $("#jeopardy").hide();
    $("#loading").show();
}

/** Hide loading spinner */
function hideLoadingView() {
    $("#loading").hide();
    $("#jeopardy").show();
}

/** Set up game */
async function setupAndStart() {
    showLoadingView();
    const catIds = await getCategoryIds();
    categories = await Promise.all(catIds.map(getCategory));
    await fillTable();
    hideLoadingView();
}

/** Event handlers */
$("#start").on("click", setupAndStart);
$("#jeopardy").on("click", "td", handleClick);
