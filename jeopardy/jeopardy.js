// jeopardy.js

// Constants for game configuration
const NUM_CATEGORIES = 6;
const NUM_QUESTIONS_PER_CAT = 5;

// === The reliable API endpoint ===
const JEOPARDY_API_BASE = "https://rithm-jeopardy.herokuapp.com/api"; // No proxy needed!

// Array to store the fetched category data, including clues
let categories = [];

/**
 * Fetches NUM_CATEGORIES category IDs from the API that have at least NUM_QUESTIONS_PER_CAT clues.
 * It attempts to find valid categories multiple times if initial attempts don't yield enough.
 * @returns {Promise<Array<number>>} A promise that resolves to an array of valid category IDs.
 */
async function getCategoryIds() {
    let validCategoryIds = new Set();
    let attempts = 0;
    const maxAttempts = 100;

    console.log("Starting getCategoryIds...");

    while (validCategoryIds.size < NUM_CATEGORIES && attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts} to fetch categories. Valid found: ${validCategoryIds.size}/${NUM_CATEGORIES}`);
        try {
            const res = await axios.get(`${JEOPARDY_API_BASE}/categories`, {
                params: { count: 100 },
            });

            if (!Array.isArray(res.data) || res.data.length === 0) {
                console.warn("API did not return an array of categories or returned an empty array:", res.data);
                continue;
            }

            const candidates = _.shuffle(res.data);
            console.log(`Fetched ${candidates.length} candidate categories from this batch.`);

            for (let cat of candidates) {
                if (validCategoryIds.size >= NUM_CATEGORIES) break;
                if (validCategoryIds.has(cat.id)) continue;

                try {
                    const catDataResponse = await axios.get(`${JEOPARDY_API_BASE}/category`, {
                        params: { id: cat.id },
                    });

                    if (catDataResponse && catDataResponse.data && catDataResponse.data.clues &&
                        Array.isArray(catDataResponse.data.clues) &&
                        catDataResponse.data.clues.length >= NUM_QUESTIONS_PER_CAT) {
                        validCategoryIds.add(cat.id);
                        console.log(`Found valid category ID: ${cat.id} (Title: ${cat.title})`);
                    } else {
                        console.warn(`Category ${cat.id} (Title: ${cat.title}) has insufficient clues (${catDataResponse?.data?.clues?.length || 0}) or malformed data. Full response for category:`, catDataResponse.data);
                    }
                } catch (err) {
                    console.warn(`Error checking details for category ID ${cat.id}:`, err);
                }
            }
        } catch (err) {
            console.error("Error fetching initial list of categories:", err);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (validCategoryIds.size < NUM_CATEGORIES) {
        console.error(`Could not find enough valid categories after ${attempts} attempts. Found: ${validCategoryIds.size}, Needed: ${NUM_CATEGORIES}. This game might not be able to start.`);
    } else {
        console.log(`Successfully found ${validCategoryIds.size} valid category IDs.`);
    }

    return Array.from(validCategoryIds);
}

/**
 * Fetches detailed data for a specific category ID.
 * It selects a random sample of clues from the category.
 * @param {number} catId - The ID of the category to fetch.
 * @returns {Promise<Object>} A promise that resolves to an object containing the category title and its clues.
 * @throws {Error} If the category data is invalid or insufficient.
 */
async function getCategory(catId) {
    console.log(`Fetching detailed data for category ID: ${catId}`);
    try {
        const response = await axios.get(`${JEOPARDY_API_BASE}/category`, {
            params: { id: catId },
        });

        if (!response || !response.data || !response.data.clues || !Array.isArray(response.data.clues) || response.data.clues.length < NUM_QUESTIONS_PER_CAT) {
            const errorMessage = `Invalid or insufficient clue data for category ID ${catId}. Clues found: ${response?.data?.clues?.length || 0}`;
            console.error(errorMessage, response.data);
            throw new Error(errorMessage);
        }

        const clues = _.sampleSize(response.data.clues, NUM_QUESTIONS_PER_CAT).map(clue => ({
            question: clue.question,
            answer: clue.answer,
            showing: null, // 'null' for hidden, 'question' for question shown, 'answer' for answer shown
        }));

        console.log(`Successfully processed category ID: ${catId}, Title: ${response.data.title}, Clues: ${clues.length}`);
        return { title: response.data.title, clues };
    } catch (err) {
        console.error(`Failed to fetch or process category ID ${catId}:`, err);
        throw err;
    }
}

/**
 * Fills the HTML table with category headers and question cells.
 * Initially, all question cells display a '?'.
 */
async function fillTable() {
    console.log("Filling table with categories:", categories);
    const $thead = $("thead").empty();
    const $tbody = $("tbody").empty();

    // Create the header row for category titles
    const $trHeader = $("<tr>");
    for (let cat of categories) {
        if (cat && cat.title) {
            $trHeader.append($("<th>").text(cat.title));
        } else {
            console.warn("Skipping category with missing title during table header creation:", cat);
            $trHeader.append($("<th>").text("N/A"));
        }
    }
    $thead.append($trHeader);

    // Create rows for questions (clues)
    for (let clueIdx = 0; clueIdx < NUM_QUESTIONS_PER_CAT; clueIdx++) {
        const $tr = $("<tr>");
        for (let catIdx = 0; catIdx < NUM_CATEGORIES; catIdx++) {
            const clueExists = categories[catIdx] && categories[catIdx].clues && categories[catIdx].clues[clueIdx];
            const $td = $("<td>")
                .attr("id", `${catIdx}-${clueIdx}`);

            // Wrap the content in a span for specific styling of '?'
            $td.html(`<span class="clue-content ${clueExists ? 'clue-initial' : ''}">${clueExists ? "?" : "N/A"}</span>`);

            $tr.append($td);
        }
        $tbody.append($tr);
    }
    console.log("Table filled.");
}

/**
 * Handles clicks on clue cells.
 * - If a cell shows '?', it reveals the question.
 * - If a cell shows a question, it reveals the answer.
 * - If a cell shows an answer, nothing happens.
 * @param {Event} evt - The click event object.
 */
function handleClick(evt) {
    const $td = $(evt.target).closest('td'); // Ensure we target the td, not the span inside
    const id = $td.attr("id");
    const [catIdx, clueIdx] = id.split("-").map(Number);

    const clue = categories?.[catIdx]?.clues?.[clueIdx];

    // If no clue or if already showing answer, do nothing (cell is disabled by CSS pointer-events)
    if (!clue || clue.showing === "answer") {
        console.warn(`Cell ${id} is already answered or has no valid clue. No action.`);
        return;
    }

    const $clueContentSpan = $td.find('.clue-content'); // Get the span inside the td

    if (clue.showing === null) {
        $clueContentSpan.text(clue.question);
        $clueContentSpan.removeClass('clue-initial'); // Remove '?' specific styling
        clue.showing = "question";
    } else if (clue.showing === "question") {
        $clueContentSpan.text(clue.answer);
        clue.showing = "answer";
        $td.addClass('answered'); // Add class for green background and disabled clicks
    }
}

/**
 * Shows the loading spinner and hides the Jeopardy table.
 */
function showLoadingView() {
    console.log("Showing loading view.");
    $("#jeopardy").hide(); // Hide the table initially
    $("#loading").show(); // Show loading message
    $("#start").prop('disabled', true); // Disable start button during loading
}

/**
 * Hides the loading spinner and shows the Jeopardy table.
 */
function hideLoadingView() {
    console.log("Hiding loading view.");
    $("#loading").hide(); // Hide loading message
    $("#jeopardy").show(); // Show the table after loading
    $("#start").prop('disabled', false); // Enable start button after loading
}

/**
 * Sets up and starts a new Jeopardy game.
 * This involves fetching categories, populating the game board, and handling loading states.
 */
async function setupAndStart() {
    console.log("Starting setupAndStart...");
    try {
        showLoadingView();

        // Reset categories array for a new game
        categories = [];

        // When starting a new game, we need to completely clear and reset the table
        // This is handled by fillTable after new categories are fetched.
        // We only need to ensure the HTML elements are ready to be re-filled.
        $("thead").empty();
        $("tbody").empty();

        const catIds = await getCategoryIds();
        if (catIds.length < NUM_CATEGORIES) {
            throw new Error(`Not enough valid categories returned from API. Found ${catIds.length}, needed ${NUM_CATEGORIES}. The game cannot start.`);
        }
        console.log(`Fetched ${catIds.length} category IDs:`, catIds);

        categories = await Promise.all(catIds.map(getCategory));
        console.log("All categories details fetched:", categories);

        await fillTable();
        console.log("Game setup complete!");
    } catch (err) {
        console.error("Failed to set up game:", err);
        alert(`Sorry, we had trouble loading the game: ${err.message || "An unknown error occurred"}. Please try again.`);
        // Ensure table is hidden and button re-enabled even on error
        $("#jeopardy").hide();
        $("#loading").hide();
        $("#start").prop('disabled', false);
    } finally {
        hideLoadingView(); // This will show the table if setup was successful
    }
}

/** Event handlers */
$("#start").on("click", setupAndStart);
$("#jeopardy").on("click", "td", handleClick);

$(document).ready(function () {
    // Game will not auto-start. Table is hidden by default in HTML.
    // The user must click the 'Start / Restart Game' button.
    // No initial setupAndStart() call here.
});