document.getElementById('checkBtn').addEventListener('click', async () => {
    const phoneNumber = document.getElementById('phoneInput').value.trim();
    const resultCard = document.getElementById('resultCard');
    const cardStatus = document.getElementById('cardStatus');
    const resPhone = document.getElementById('resPhone');
    const resCategory = document.getElementById('resCategory');
    const resCount = document.getElementById('resCount');
    const resDate = document.getElementById('resDate');

    if (!phoneNumber) {
        alert('Please enter a phone number to check.');
        return;
    }

    try {
        // Hit our local express lookup gateway dynamically!
        const response = await fetch(`/api/check/${phoneNumber}`);
        const data = await response.json();

        // Reveal the result view card
        resultCard.style.display = 'block';

        if (data.is_flagged) {
            // Update UI to reflect a threat match
            resultCard.className = 'result-card danger';
            cardStatus.innerHTML = `🚨 FRAUD MATCH: ${data.risk_level}`;
            
            resPhone.innerText = data.details.phone;
            resCategory.innerText = data.details.category;
            resCount.innerText = data.details.total_reports;
            resDate.innerText = new Date(data.details.last_incident).toLocaleString();
        } else {
            // Update UI to show a clean scan vector
            resultCard.className = 'result-card clean';
            cardStatus.innerHTML = `✅ CLEAN ACCOUNT`;
            
            resPhone.innerText = phoneNumber;
            resCategory.innerText = 'No known issues';
            resCount.innerText = '0';
            resDate.innerText = 'Never Flagged';
        }

    } catch (err) {
        alert('Could not communicate with the Igor Ghana API backend.');
        console.error(err);
    }
});