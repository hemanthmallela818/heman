import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text } = await request.json();
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    // Check configuration
    if (!webhookUrl || webhookUrl.includes('your-voice-agent-endpoint')) {
      return NextResponse.json({ 
        error: "N8N_WEBHOOK_URL is not configured in .env.local. Please paste your actual n8n webhook URL." 
      }, { status: 400 });
    }

    console.log(`[Voice API] Sending transcription to n8n: "${text}"`);

    // Call the n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text, 
        timestamp: new Date().toISOString(),
        source: 'smartstore-dashboard'
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Voice API] n8n Webhook returned error code ${response.status}:`, errText);
      return NextResponse.json({ 
        error: `n8n webhook error: ${response.status} - ${errText}` 
      }, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`[Voice API] n8n Webhook Response Content-Type: "${contentType}"`);

    // 1. Case A: If response is already binary audio (e.g. from an ElevenLabs node in n8n)
    if (contentType.includes('audio') || contentType.includes('application/octet-stream')) {
      const audioBuffer = await response.arrayBuffer();
      return new Response(audioBuffer, {
        headers: {
          'Content-Type': contentType || 'audio/mpeg',
        },
      });
    } 
    
    // 2. Case B: If response is JSON or Text
    let textToConvert = '';
    const rawText = await response.text();
    
    if (contentType.includes('application/json') && rawText.trim().length > 0) {
      try {
        const data = JSON.parse(rawText);
        
        // If the JSON already contains a base64 encoded audio string, decode and play it
        const base64Audio = data.audio || data.audioData || data.data;
        if (base64Audio && typeof base64Audio === 'string' && base64Audio.length > 50) {
          const base64Clean = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
          const audioBuffer = Buffer.from(base64Clean, 'base64');
          return new Response(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
            },
          });
        }
        
        // Otherwise, extract the text string response to convert it into audio
        textToConvert = data.text || data.message || data.output || data.response || '';
      } catch (parseErr) {
        console.warn("[Voice API] Failed to parse JSON body, falling back to raw text:", parseErr);
        textToConvert = rawText;
      }
    } else {
      // Case C: If response is plain text (or empty JSON)
      textToConvert = rawText;
    }

    // 3. Convert text to audio using Google Translate TTS service (Server-side TTS Conversion)
    if (textToConvert && textToConvert.trim().length > 0) {
      console.log(`[Voice API] Converting n8n text response to audio: "${textToConvert}"`);
      
      // Limit text to 200 characters (Google Translate TTS limit)
      const cleanText = textToConvert.substring(0, 200).trim();
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
      
      try {
        const ttsResponse = await fetch(ttsUrl, {
          headers: {
            'Referer': 'https://translate.google.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        
        if (ttsResponse.ok) {
          const audioBuffer = await ttsResponse.arrayBuffer();
          return new Response(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'X-TTS-Source': 'Google Translate',
              'X-Response-Text': encodeURIComponent(textToConvert) // Keep original text in headers for display
            },
          });
        }
      } catch (ttsErr) {
        console.warn("[Voice API] Server-side TTS failed, forwarding plain text for client SpeechSynthesis:", ttsErr);
      }
    }

    // If TTS conversion failed or returned text is empty, send text/json response back
    return NextResponse.json({ 
      text: textToConvert || "I received a response from n8n, but it contained no text payload." 
    });

  } catch (err) {
    console.error("[Voice API] Proxy connection failure:", err);
    return NextResponse.json({ error: `Connection failed: ${err.message}` }, { status: 500 });
  }
}
