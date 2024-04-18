// Function to get card information from Scryfall API
function getCardInfo(cardName) {
    // Fetch card data from Scryfall API
    fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`)
    .then(response => response.json())
    .then(data => {
        // Check if card data exists
        if (data.object === 'card') {
            // Display card information in a tooltip
            const tooltip = document.createElement('div');
            tooltip.classList.add('tooltip');
            tooltip.innerHTML = `
                <h3>${data.name}</h3>
                <p><strong>Type:</strong> ${data.type_line}</p>
                <p><strong>Rarity:</strong> ${data.rarity}</p>
                <p><strong>Text:</strong> ${data.oracle_text}</p>
                <img src="${data.image_uris.normal}" alt="${data.name}">
            `;
            // Position the tooltip near the cursor
            document.body.appendChild(tooltip);
            document.addEventListener('mousemove', function(event) {
                tooltip.style.top = event.pageY + 10 + 'px';
                tooltip.style.left = event.pageX + 10 + 'px';
            });
        } else {
            console.error('Card not found:', cardName);
        }
    })
    .catch(error => {
        console.error('An error occurred:', error);
    });
}

// Add event listeners for mouseover and mouseout on elements with class "cardName"
document.querySelectorAll('.cardName').forEach(cardName => {
    cardName.addEventListener('mouseover', function() {
        // Get the card name from the data-cardname attribute
        const name = this.getAttribute('data-cardname');
        // Call the function to get card information
        getCardInfo(name);
    });

    // Hide the tooltip when the cursor leaves the element
    cardName.addEventListener('mouseout', function() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    });
});
