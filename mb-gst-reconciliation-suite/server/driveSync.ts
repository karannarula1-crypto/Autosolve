import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

// Using either API Key or Service Account credentials
export async function fetchInvoicesFromDrive(folderId: string) {
  
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  const credentialsBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64?.trim();
  
  if (!apiKey && !credentialsBase64) {
    console.log("No Google Drive credentials found. Returning mock OCR data.");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    return [
      {
        sourceFile: "mock_invoice_001.pdf",
        vendorName: "Mock Vendor OCR",
        vendorPan: "MOCKP1234A",
        invoiceNo: "INV-OCR-001",
        invoiceDate: "15-Apr-24",
        gstAmount: 2200,
        recipientGstin: "27AABCM1234C1Z1",
        vendorGstin: "27MOCKV1234C1Z1"
      },
      {
        sourceFile: "mock_invoice_002.jpeg",
        vendorName: "Another Tech Pvt Ltd",
        vendorPan: "TECHP5678B",
        invoiceNo: "INV-OCR-002",
        invoiceDate: "18-Apr-24",
        gstAmount: 4800,
        recipientGstin: "27AABCM1234C1Z1",
        vendorGstin: "27TECHV5678C1Z1"
      }
    ];
  }

  let auth;
  let authClient;
  if (credentialsBase64) {
    try {
      const decodedString = Buffer.from(credentialsBase64, 'base64').toString('utf-8');
      const credentials = JSON.parse(decodedString);
      console.log("Successfully parsed service account JSON. Client email:", credentials.client_email);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      authClient = await auth.getClient();
    } catch (error) {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64. Are you sure it is valid base64? Error:", error);
      throw new Error("Failed to parse Service Account credentials. Make sure you entered the correct Base64 string.");
    }
  } else if (apiKey) {
    console.log("Using Google Drive API key.");
    authClient = apiKey;
  }

  const drive = google.drive({ 
    version: 'v3', 
    auth: authClient
  });

  try {
    console.log(`Fetching files from Google Drive folder: ${folderId}`);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='image/jpeg' or mimeType='image/png') and trashed=false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 50,
      key: !authClient && apiKey ? apiKey : undefined,
    });

    const files = res.data.files || [];
    console.log(`Found ${files.length} invoice files.`);
    
    if (files.length === 0) {
      console.log(`No files found.`);
      if (authClient && !apiKey) {
        throw new Error(`No files found. Ensure the service account email is added as a 'Viewer' on the Google Drive folder '${folderId}'.`);
      } else {
        throw new Error(`No files found. Ensure the Google Drive folder '${folderId}' is shared publicly ('Anyone with the link').`);
      }
    }

    const extractedData = [];

    for (const file of files) {
      if (!file.id) continue;
      console.log(`Processing file: ${file.name}`);
      
      try {
        const fileContent = await drive.files.get({
          fileId: file.id,
          alt: 'media',
          key: !authClient && apiKey ? apiKey : undefined,
        }, { responseType: 'arraybuffer' });

        const buffer = Buffer.from(fileContent.data as ArrayBuffer);
        const base64Data = buffer.toString('base64');
        
        // Use Gemini API to extract inward register information
        const prompt = `
          Extract the following details from this invoice:
          1. Vendor Name
          2. Vendor PAN (if present, else leave empty)
          3. Invoice Number
          4. Invoice Date (DD-MMM-YY, e.g., 01-Jan-24)
          5. GST Amount (Total Tax Amount or CGST+SGST+IGST aggregated)
          6. Recipient GSTIN (if present)
          7. Vendor GSTIN (if present)
          
          Return ONLY a raw JSON object with no markdown formatting. The JSON should have these exact keys:
          {
            "vendorName": string,
            "vendorPan": string,
            "invoiceNo": string,
            "invoiceDate": string,
            "gstAmount": number,
            "recipientGstin": string,
            "vendorGstin": string
          }
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: file.mimeType || 'application/pdf',
                    data: base64Data
                  }
                },
                { text: prompt }
              ]
            }
          ]
        });

        let jsonText = response.text || "{}";
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonText);
        
        extractedData.push({
          sourceFile: file.name,
          ...data
        });
      } catch (err) {
        console.error(`Failed to process file ${file.name}:`, err);
      }
    }

    return extractedData;
  } catch (error) {
    console.error("Error accessing Google Drive:", error);
    throw error;
  }
}
