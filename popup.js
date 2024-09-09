document.getElementById("apply-filter").addEventListener("click", function() {
    const minAge = document.getElementById("min-age").value;
    const minAgeUnit = document.getElementById("min-age-unit").value;
    const maxAge = document.getElementById("max-age").value;
    const maxAgeUnit = document.getElementById("max-age-unit").value;

    const filterCriteria = {
        minAge: parseInt(minAge),
        minAgeUnit: minAgeUnit,
        maxAge: parseInt(maxAge),
        maxAgeUnit: maxAgeUnit
    };

    // Send the filter criteria to the content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyFilter", filter: filterCriteria});
    });

    // Close the popup
    window.close();
});
