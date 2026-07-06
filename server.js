// ==========================================
// 1. CORE MODULE INGESTIONS & GATEWAYS
// ==========================================
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 2. MIDDLEWARE CONFIGURATIONS
// ==========================================
// Parse incoming JSON request payloads automatically
app.use(express.json());

// Serve your dark-mode frontend web portal from the 'public' folder
app.use(express.static('public'));

// Establish connection instance to your Supabase Cloud Database Engine
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// 🛡️ SECURITY SHIELD A: ANTI-SPAM RATE LIMITER
// ==========================================
const publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute tracking frame window
    max: 100, // Limit each client IP machine to 100 hits per window session
    message: {
        error: "Too many lookup attempts from this device. Please try again after 15 minutes."
    },
    standardHeaders: true, // Returns rate limit info in standard response headers
    legacyHeaders: false,  // Disables outdated legacy headers
});

// Apply the anti-spam protection specifically to lookups and USSD endpoints
app.use('/api/check', publicApiLimiter);
app.use('/api/ussd', publicApiLimiter);

// ==========================================
// 🛡️ SECURITY SHIELD B: B2B PARTNER KEY VERIFICATION
// ==========================================
async function verifyApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: "Access Denied. Secure 'x-api-key' header is missing." });
    }

    try {
        // Query the database directory to see if this merchant profile key matches
        const { data: client, error } = await supabase
            .from('b2b_clients')
            .select('business_name, is_active')
            .eq('api_key_hash', apiKey.trim())
            .maybeSingle();

        if (error) throw error;

        if (!client) {
            return res.status(403).json({ error: "Forbidden. The provided API key is invalid." });
        }

        if (!client.is_active) {
            return res.status(403).json({ error: "Forbidden. This business account has been deactivated." });
        }

        // Pass the identified business label onto the request object context
        req.businessName = client.business_name;
        next();
    } catch (err) {
        res.status(500).json({ error: "Security Gateway Exception: " + err.message });
    }
}

// ==========================================
// 📡 ROUTE ALIASES & NETWORK ENDPOINTS
// ==========================================

// ROUTE 1: BASELINE SERVICE STATUS CHECK
app.get('/api/status', (req, res) => {
    res.json({
        status: "Active",
        platform: "Igor Ghana API Gateway",
        timestamp: new Date().toISOString()
    });
});

// ROUTE 2: PUBLIC REAL-TIME SEARCH INDEX (Web App Gateway)
app.get('/api/check/:phone_number', async (req, res) => {
    const { phone_number } = req.params;

    try {
        const { data: scammer, error } = await supabase
            .from('scammers')
            .select('phone_number, fraud_category, report_count, last_flagged_at')
            .eq('phone_number', phone_number.trim())
            .maybeSingle();

        if (error) throw error;

        if (scammer) {
            return res.status(200).json({
                is_flagged: true,
                risk_level: scammer.report_count >= 3 ? "CRITICAL" : "HIGH",
                details: {
                    phone: scammer.phone_number,
                    category: scammer.fraud_category,
                    total_reports: scammer.report_count,
                    last_incident: scammer.last_flagged_at
                }
            });
        }

        res.status(200).json({
            is_flagged: false,
            risk_level: "CLEAN",
            message: "No current fraud records match this query vector."
        });

    } catch (err) {
        res.status(500).json({ error: "Internal Gateway Error: " + err.message });
    }
});

// ROUTE 3: SECURED FRAUD LOG INGESTION (Protected via B2B Authorization Headers)
app.post('/api/report', verifyApiKey, async (req, res) => {
    const { phone_number, report_text, category } = req.body;

    if (!phone_number || !report_text) {
        return res.status(400).json({ error: "Phone number and report text are mandatory slots." });
    }

    try {
        const { error: reportError } = await supabase
            .from('fraud_reports')
            .insert([{ 
                scammer_phone: phone_number.trim(), 
                raw_report_text: report_text.trim() 
            }]);

        if (reportError) throw reportError;

        const { data: existingScammer, error: checkError } = await supabase
            .from('scammers')
            .select('id, report_count')
            .eq('phone_number', phone_number.trim())
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingScammer) {
            const { error: updateError } = await supabase
                .from('scammers')
                .update({ 
                    report_count: existingScammer.report_count + 1,
                    last_flagged_at: new Date().toISOString()
                })
                .eq('id', existingScammer.id);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('scammers')
                .insert([{
                    phone_number: phone_number.trim(),
                    fraud_category: category || 'General MoMo Fraud',
                    report_count: 1
                }]);

            if (insertError) throw insertError;
        }

        res.status(201).json({
            success: true,
            message: `Incident reported successfully via secure partner node: ${req.businessName}`
        });

    } catch (err) {
        res.status(500).json({ error: "Internal Gateway Error: " + err.message });
    }
});

// ROUTE 4: OFFLINE TELECOM SIMULATOR HUB (USSD Interface logic)
app.post('/api/ussd', async (req, res) => {
    const { phoneNumber, text, sessionId } = req.body;
    let response = "";
    const textArray = text ? text.split('*') : [];

    if (text === "") {
        response = `CON Welcome to Igor Ghana Anti-Fraud\n`;
        response += `1. Check a Phone Number\n`;
        response += `2. Report a Fraudster`;
    } 
    else if (textArray[0] === '1' && textArray.length === 1) {
        response = `CON Enter the phone number you want to check:`;
    } 
    else if (textArray[0] === '1' && textArray.length === 2) {
        const targetNumber = textArray[1].trim();

        try {
            const { data: scammer, error } = await supabase
                .from('scammers')
                .select('report_count, fraud_category')
                .eq('phone_number', targetNumber)
                .maybeSingle();

            if (error) throw error;

            if (scammer) {
                const risk = scammer.report_count >= 3 ? "CRITICAL RISK" : "HIGH RISK";
                response = `END 🚨 WARNING!\n${targetNumber} is flagged as ${risk}.\nCategory: ${scammer.fraud_category}\nReports: ${scammer.report_count}`;
            } else {
                response = `END ✅ CLEAN LEDGER\nNo active fraud reports found for ${targetNumber}. Proceed with caution.`;
            }
        } catch (err) {
            response = `END System Error. Please try again later.`;
        }
    } 
    else if (textArray[0] === '2' && textArray.length === 1) {
        response = `CON Enter the scammer's phone number:`;
    } 
    else if (textArray[0] === '2' && textArray.length === 2) {
        response = `CON Enter short description of the fraud (e.g., Fake Promo, MoMo Cashout):`;
    } 
    else if (textArray[0] === '2' && textArray.length === 3) {
        const scammerPhone = textArray[1].trim();
        const fraudReason = textArray[2].trim();

        try {
            await supabase.from('fraud_reports').insert([{ 
                scammer_phone: scammerPhone, 
                raw_report_text: `USSD Report: ${fraudReason}` 
            }]);

            const { data: existing } = await supabase
                .from('scammers')
                .select('id, report_count')
                .eq('phone_number', scammerPhone)
                .maybeSingle();

            if (existing) {
                await supabase.from('scammers')
                    .update({ report_count: existing.report_count + 1, last_flagged_at: new Date().toISOString() })
                    .eq('id', existing.id);
            } else {
                await supabase.from('scammers').insert([{
                    phone_number: scammerPhone,
                    fraud_category: 'USSD Citizen Flag',
                    report_count: 1
                }]);
            }

            response = `END Thank you.\nReport logged successfully. Igor Ghana database updated.`;
        } catch (err) {
            response = `END Failed to log report. Try again.`;
        }
    }

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(response);
});

// ==========================================
// 3. LAUNCH SERVICE ENGINE STREAM
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Igor Ghana Central Backend Gateway running on port ${PORT}`);
});