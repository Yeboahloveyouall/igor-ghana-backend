// ==========================================
// 🔍 SEARCH GATEWAY LOGIC (Runs on User Lookup Interface)
// ==========================================
const checkBtn = document.getElementById('checkBtn');
if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
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
}

// ==========================================
// 🛡️ ADMIN INTELLIGENCE LOGS FEED (Runs on admin.html)
// ==========================================
const logsTableBody = document.getElementById('logsTableBody');
if (logsTableBody) {
    // Automatically fetch real-time reports when the admin panel opens
    window.addEventListener('DOMContentLoaded', fetchAdminLogs);
}

async function fetchAdminLogs() {
    try {
        const response = await fetch('/api/admin/logs');
        if (!response.ok) throw new Error('Failed to retrieve intelligence logs stream');
        
        const logs = await response.json();
        logsTableBody.innerHTML = ''; // Clear loading placeholder text

        if (logs.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">No active fraud incidents recorded in ledger.</td></tr>`;
            return;
        }

        // Populate table records dynamically
        logs.forEach(log => {
            const row = document.createElement('tr');
            
            // Extract the secure partner label safely
            const clientName = log.b2b_clients ? log.b2b_clients.business_name : 'USSD Citizen Node';
            
            row.innerHTML = `
                <td><strong>${log.id}</strong></td>
                <td style="color: #ff4d4d; font-family: monospace;">${log.phone_number}</td>
                <td><span class="badge-category">${log.category || 'General'}</span></td>
                <td>${clientName}</td>
                <td style="color: #aaa; font-size: 0.9em;">${new Date(log.created_at).toLocaleString()}</td>
            `;
            logsTableBody.appendChild(row);
        });

    } catch (err) {
        console.error('Admin Interface Exception:', err);
        logsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ff4d4d;">⚠️ Error synchronizing live network logs.</td></tr>`;
    }
}