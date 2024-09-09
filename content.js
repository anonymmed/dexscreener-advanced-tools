window.addEventListener('load', () => {
    console.log("DexScreener content script loaded.");

    function createFloatingButton() {
        const filterButton = document.createElement("button");
        filterButton.id = "advanced-filter-float-btn";
        filterButton.innerText = "DexScreener Advanced";
        filterButton.style.position = "fixed";
        filterButton.style.right = "-70px";
        filterButton.style.top = "50%";
        filterButton.style.transform = "translateY(-50%) rotate(90deg)";
        filterButton.style.zIndex = "1000";
        filterButton.style.backgroundColor = "var(--chakra-colors-accent-600)";
        filterButton.style.color = "#fff";
        filterButton.style.border = "none";
        filterButton.style.borderRadius = "5px";
        filterButton.style.cursor = "pointer";
        filterButton.style.padding = "10px";
        filterButton.style.whiteSpace = "nowrap";

        document.body.appendChild(filterButton);

        createModal();

        filterButton.addEventListener("click", function() {
            document.getElementById('filter-modal').style.display = 'block';
        });
    }

    function createModal() {
        fetch(chrome.runtime.getURL('assets/html/modal.html'))
        .then(response => response.text())
        .then(html => {
            document.body.insertAdjacentHTML('beforeend', html); // Insert the modal into the page
            
            document.querySelector('.close-btn').addEventListener("click", function() {
                document.getElementById('filter-modal').style.display = 'none';
            });

            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', function() {
                    const tab = this.dataset.tab;
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
                    this.classList.add('active');
                    document.getElementById(`${tab}-tab-content`).style.display = 'block';
                });
            });

            document.getElementById('apply-filter').addEventListener('click', applyFilter);
            document.getElementById('clear-filter').addEventListener('click', clearFilter);
            document.getElementById('create-alert').addEventListener('click', createAlert);
            
            document.getElementById('alert-list').addEventListener('click', function(event) {
                if (event.target.classList.contains('delete-alert-btn')) {
                    deleteAlert(event.target.dataset.index);
                }
            });

            // Add functionality to close the modal when clicking outside of the content
            document.getElementById('filter-modal').addEventListener('click', function(event) {
                if (event.target === this) {
                    this.style.display = 'none';
                }
            });

            // Add event listeners to input fields to trigger filter application on Enter key press
            document.getElementById('token-symbol').addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    document.getElementById('apply-filter').click();
                }
            });

            document.getElementById('token-public-key').addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    document.getElementById('apply-filter').click();
                }
            });

            // Load existing alerts from storage
            loadAlertsFromStorage();

        })
        .catch(error => {
            console.error('Error loading modal:', error);
            alert("Failed to load the modal content. Please refresh the page.");
        });
    }

    let alertIndex = 0;

    function applyFilter() {
        const symbol = document.getElementById('token-symbol').value || null;
        const publicKey = document.getElementById('token-public-key').value || null;
        const publicKeyError = document.getElementById('public-key-error'); // Error message div
    // Check if the public key has at least 40 characters
    if (publicKey && publicKey.length < 40) {
        publicKeyError.style.display = 'block'; // Show the error message
        return; // Stop the function if the public key is too short
    } else {
        publicKeyError.style.display = 'none'; // Hide the error message if input is valid
    }

        if (symbol || publicKey) {
            displayFilteredResults({
                tokenSymbol: symbol,
                tokenPublicKey: publicKey
            });
        }
    }

    function clearFilter() {
        document.getElementById('token-symbol').value = '';
        document.getElementById('token-public-key').value = '';
        document.getElementById('filtered-results').innerHTML = '';
    }

    // Use chrome.storage.sync instead of localStorage for persistent storage
    function saveAlertToStorage(alert) {
        chrome.storage.sync.get({ alerts: [] }, function(result) {
            const alerts = result.alerts;
            alerts.push(alert);
            chrome.storage.sync.set({ alerts }, function() {
                console.log('Alert saved to storage:', alert);
            });
        });
    }

    function createAlert() {
        const symbol = document.getElementById('alert-symbol').value;            
        const alertError = document.getElementById('alert-error');

        // Check if the symbol has at least 3 characters
        if (symbol.length < 3) {
            alertError.style.display = 'block'; // Show the error message
            return; // Stop the function if the symbol is too short
        } else {
            alertError.style.display = 'none'; // Hide the error message if input is valid
        }

        if (symbol) {
            const alertList = document.getElementById('alert-list');
            alertIndex++;
            const alertItem = document.createElement('div');
            alertItem.className = 'alert-item'; // Default style
            alertItem.id = `alert-${alertIndex}`;
            alertItem.dataset.symbol = symbol;
            alertItem.innerHTML = `
                <span>${symbol}</span>
                <button class="delete-alert-btn" data-index="${alertIndex}">Delete</button>
            `;
            alertList.appendChild(alertItem);
            document.getElementById('alert-symbol').value = ''; // Clear input after adding alert
            
            // Save alert to chrome storage
            saveAlertToStorage({ symbol, alertIndex });

            startAlertChecking(symbol, alertIndex);
        }
    }
    function displayFilteredResults(filterCriteria) {
        const rows = document.querySelectorAll('a.ds-dex-table-row');
        const resultsContainer = document.getElementById("filtered-results");
        resultsContainer.innerHTML = ''; // Clear previous results

        filterCriteria.tokenPublicKey = filterCriteria?.tokenPublicKey?.trim() || null;
        filterCriteria.tokenSymbol = filterCriteria?.tokenSymbol?.trim() || null;

        // Array to hold clones of filtered rows
        let filteredRows = [];
        const data = [];
        rows.forEach(row => {
            const symbolElement = row.querySelector('.ds-dex-table-row-base-token-symbol');
            const publicKeyElement = row.querySelector('.ds-dex-table-row-token-icon');
            const href = row.href; // Get the href attribute of the link
            const name = row.querySelector(".ds-dex-table-row-base-token-name"); // Get the name attribute of the link
            const age = row.querySelector(".ds-dex-table-row-col-pair-age");
            const liquidityandmKap = row.querySelectorAll('.ds-table-data-cell');

            if (!symbolElement && !publicKeyElement) {
                // Skip if elements are missing
                return;
            }

            if (!data.some(x => x.publicKey === publicKeyElement?.src?.trim())) {
                let publicKeyArray = publicKeyElement ? publicKeyElement?.src?.trim()?.split("/") : [];

                data.push({
                    publicKey : publicKeyArray.length > 0 ? (publicKeyArray[publicKeyArray.length -1]).split('.')[0] : "",
                    symbol: symbolElement?.innerText?.trim()?.toLowerCase(),
                    href: href,
                    name: name.textContent,
                    age: age.textContent,
                    liquidity: liquidityandmKap[0].textContent,
                    mKap: liquidityandmKap[1].textContent
                });
            }
        });
        filteredRows = data.filter(x => x.publicKey === filterCriteria?.tokenPublicKey || x.symbol.toLowerCase().includes(filterCriteria?.tokenSymbol?.toLowerCase()));
        console.log("result found : ", filteredRows);
        
        // Generate HTML for each filtered result
        filteredRows.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.innerHTML = `
                <strong>Token Address:</strong> ${result.publicKey}<br>
                <a href="${result.href}" target= "_blank" class="filtered-result-item">
                <strong>Token Symbol:</strong> ${result.symbol}<br>
                <strong>Token Name:</strong> ${result.name}<br>
                <strong>Token Age(since search):</strong> ${result.age}<br>
                <strong>Token Liquidity:</strong> ${result.liquidity}<br>
                <strong>Token Market Cap:</strong> ${result.mKap}
                </a>`;
            resultsContainer.appendChild(resultElement);
        });

        // Display the modal if it’s not already visible
        document.getElementById('filter-modal').style.display = 'block';
    }
    function showNotification(message, audio = "notification") {
        const notificationArea = document.getElementById('notification-area');
        const notificationText = document.getElementById('notification-text');
        const notificationSound = new Audio(chrome.runtime.getURL(`assets/audio/${audio}.wav`));

        notificationText.textContent = message;
        notificationArea.style.display = 'block';
        notificationArea.classList.add('show');
        notificationSound.play().then().catch((err) => {});
        setTimeout(() => {
            notificationArea.style.display = 'none';
            notificationArea.classList.remove('show');
        }, 5000); // Hide notification after 5 seconds
    }

    function deleteAlert(index) {
        const alertItem = document.getElementById(`alert-${index}`);
        if (alertItem) {
            alertItem.remove();
            // Remove from storage
            removeAlertFromStorage(index);
    
            // Clear the interval for this alert to stop the search
            if (alertIntervals[index]) {
                clearInterval(alertIntervals[index]);
                delete alertIntervals[index]; // Remove the interval reference
            }
        }
    }
    

    // Load saved alerts from chrome.storage.sync
    function loadAlertsFromStorage() {
        chrome.storage.sync.get({ alerts: [] }, function(result) {
            const alerts = result.alerts;
            alerts.forEach(alert => {
                alertIndex = alert.alertIndex; // Keep track of latest index
                const alertList = document.getElementById('alert-list');
                const alertItem = document.createElement('div');
                alertItem.className = 'alert-item'; // Default style
                alertItem.id = `alert-${alert.alertIndex}`;
                alertItem.dataset.symbol = alert.symbol;
                alertItem.innerHTML = `
                    <span>${alert.symbol}</span>
                    <button class="delete-alert-btn" data-index="${alert.alertIndex}">Delete</button>
                `;
                alertList.appendChild(alertItem);
                startAlertChecking(alert.symbol, alert.alertIndex);
            });
        });
    }

    function removeAlertFromStorage(index) {
        chrome.storage.sync.get({ alerts: [] }, function(result) {
            const updatedAlerts = result.alerts.filter(alert => alert.alertIndex !== parseInt(index));
            chrome.storage.sync.set({ alerts: updatedAlerts }, function() {
                console.log(`Alert with index ${index} removed from storage`);
            });
        });
    }
// Map to store interval IDs for each alert
const alertIntervals = {};

function startAlertChecking(symbol, alertIndex) {
    const checkInterval = 3000; // 3 seconds
    const intervalId = setInterval(() => {
        console.log('looking for token ...', symbol);
        const rows = document.querySelectorAll('a.ds-dex-table-row');
        let tokenFound = false;
        rows.forEach(row => {
            const symbolElement = row.querySelector('.ds-dex-table-row-base-token-symbol');
            const publicKeyElement = row.querySelector('.ds-dex-table-row-token-icon');
            let tokenPublicKey = '';
            if (symbolElement && symbolElement.innerText.trim().toLowerCase().includes(symbol.toLowerCase())) {
                if (publicKeyElement) {
                    const publicKeyArray = publicKeyElement?.src?.trim()?.split("/");
                    tokenPublicKey = publicKeyArray[publicKeyArray.length - 1].split('.')[0];
                }

                // Update the alert item with the found token details
                const alertItem = document.getElementById(`alert-${alertIndex}`);
                if (alertItem) {
                    alertItem.innerHTML = `
                        <span>${symbolElement.innerText.trim()}</span>
                        ${tokenPublicKey ? tokenPublicKey : 'does not exist'}
                         <button class="copy-btn" data-text="${tokenPublicKey !== '' ? tokenPublicKey : symbolElement.innerText.trim()}">Copy📋</button>
                        <button class="delete-alert-btn" data-index="${alertIndex}">Delete 🗑️</button>
                        <br>
                    `;
                    alertItem.classList.add('red-striped'); // Change style to red-striped

                    // Attach event listener for copy functionality
                    const copyBtn = alertItem.querySelector('.copy-btn');
                    copyBtn.addEventListener('click', (event) => {
                        const textToCopy = event.target.getAttribute('data-text');
                        copyToClipboard(textToCopy);
                        showNotification(`${textToCopy} Copied to clipboard`, 'done');
                    });

                    showNotification(`Token "${symbol}" has been launched!`);
                    tokenFound = true;
                }
            }
        });
        if (tokenFound) {
            clearInterval(intervalId);
        }
    }, checkInterval);

    // Store the intervalId for this alertIndex
    alertIntervals[alertIndex] = intervalId;
}


    // Call function to create the floating button when the page loads
    createFloatingButton();
});
