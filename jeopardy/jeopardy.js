// jeopardy.js

// Constants for game configuration
const NUM_CATEGORIES = 6;
const NUM_QUESTIONS_PER_CAT = 5;

// === THE FIX: Use the CORS-friendly Rithm School API directly! ===
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
        console.log(`Attempt ${attempts} to fetch categories.`);
        try {
            // Directly call the Rithm API without any proxy
            const res = await axios.get(`${JEOPARDY_API_BASE}/categories`, {
                params: { count: 100 },
            });

            console.log("Raw response data from categories API:", res.data);

            if (!Array.isArray(res.data) || res.data.length === 0) {
                console.warn("API did not return an array of categories or returned an empty array:", res.data);
                continue;
            }

            const candidates = _.shuffle(res.data);
            console.log(`Workspaceed ${candidates.length} candidate categories from this batch.`);

            for (let cat of candidates) {
                if (validCategoryIds.size >= NUM_CATEGORIES) break;
                if (validCategoryIds.has(cat.id)) continue;

                try {
                    // Directly call the Rithm API for category details
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
        console.error(`Could not find enough valid categories after ${attempts} attempts. Found: ${validCategoryIds.size}, Needed: ${NUM_QUESTIONS_PER_CAT}`); // Corrected needed value to NUM_QUESTIONS_PER_CAT
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
    console.log(`Workspaceing detailed data for category ID: ${catId}`);
    try {
        // Directly call the Rithm API for category details
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
            showing: null,
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

    const $tr = $("<tr>");
    for (let cat of categories) {
        if (cat && cat.title) {
            $tr.append($("<th>").text(cat.title));
        } else {
            // Fallback for missing title, though with validation above, this should be rare
            console.warn("Skipping category with missing title during table header creation:", cat);
            $tr.append($("<th>").text("N/A"));
        }
    }
    $thead.append($tr);

    for (let clueIdx = 0; clueIdx < NUM_QUESTIONS_PER_CAT; clueIdx++) {
        const $tr = $("<tr>");
        for (let catIdx = 0; catIdx < NUM_CATEGORIES; catIdx++) {
            // Check if the category and the specific clue exist before displaying '?'
            const clueExists = categories[catIdx] && categories[catIdx].clues && categories[catIdx].clues[clueIdx];
            const $td = $("<td>")
                .attr("id", `${catIdx}-${clueIdx}`)
                .text(clueExists ? "?" : "N/A"); // Display '?' if clue exists, otherwise "N/A"
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
    const id = evt.target.id;
    const [catIdx, clueIdx] = id.split("-").map(Number);

    // Safely access the clue object using optional chaining and nullish coalescing
    const clue = categories?.[catIdx]?.clues?.[clueIdx];

    if (!clue) {
        console.warn(`No valid clue object found for clicked cell ID: ${id}. This cell might not have valid data.`);
        return; // Exit if the clue object is not found (e.g., if cell was "N/A" or data is missing)
    }

    console.log(`Clicked clue: Cat ${catIdx}, Clue ${clueIdx}. Current showing: ${clue.showing}`);

    if (clue.showing === null) {
        $(`#${id}`).text(clue.question);
        clue.showing = "question";
    } else if (clue.showing === "question") {
        $(`#${id}`).text(clue.answer);
        clue.showing = "answer";
    }
}

/**
 * Shows the loading spinner and hides the Jeopardy table.
 */
function showLoadingView() {
    console.log("Showing loading view.");
    $("#jeopardy").hide();
    $("#loading").show();
}

/**
 * Hides the loading spinner and shows the Jeopardy table.
 */
function hideLoadingView() {
    console.log("Hiding loading view.");
    $("#loading").hide();
    $("#jeopardy").show();
}

/**
 * Sets up and starts a new Jeopardy game.
 * This involves fetching categories, populating the game board, and handling loading states.
 */
async function setupAndStart() {
    console.log("Starting setupAndStart...");
    try {
        showLoadingView();

        const catIds = await getCategoryIds();
        if (catIds.length < NUM_CATEGORIES) {
            throw new Error(`Not enough valid categories returned from API. Found ${catIds.length}, needed ${NUM_CATEGORIES}.`);
        }
        console.log(`Workspaceed ${catIds.length} category IDs:`, catIds);

        // Fetch detailed data for all selected categories concurrently using Promise.all
        categories = await Promise.all(catIds.map(getCategory));
        console.log("All categories details fetched:", categories);

        await fillTable();
        console.log("Game setup complete!");
    } catch (err) {
        console.error("Failed to set up game:", err);
        alert(`Sorry, we had trouble loading the game: ${err.message || "An unknown error occurred"}. Please try again.`);
    } finally {
        hideLoadingView();
    }
}

/** Event handlers */
$("#start").on("click", setupAndStart);
$("#jeopardy").on("click", "td", handleClick);

$(document).ready(function () {
    // setupAndStart(); // Uncomment this to auto-start on page load
});