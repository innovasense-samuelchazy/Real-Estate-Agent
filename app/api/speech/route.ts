import { NextRequest, NextResponse } from 'next/server';

// Use Edge Runtime for longer execution time
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    console.log('Speech API route called', { 
      isVercel: process.env.VERCEL === '1',
      headers: Object.fromEntries(request.headers.entries())
    });
    
    // Get the form data from the request
    const formData = await request.formData();
    
    // Get the audio blob
    const audioFile = formData.get('audio') as File;
    
    // Check if this is a test mode request that should generate a test audio file
    const isTestMode = formData.get('testMode') === 'true';
    let testAudioFile: File | null = null;
    
    if (isTestMode) {
      console.log('Test mode activated - creating test audio file');
      
      try {
        // Create a simple test WAV file - this is a minimal valid WAV with 1 second of silence
        // WAV header (44 bytes) + 1 second of silent audio at 8000Hz, 8-bit, mono
        const sampleRate = 8000;
        const bytesPerSample = 1;
        const channels = 1;
        const seconds = 1;
        
        const dataSize = seconds * sampleRate * bytesPerSample * channels;
        const fileSize = 36 + dataSize;
        
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        
        // WAV header
        // "RIFF" chunk descriptor
        view.setUint8(0, 'R'.charCodeAt(0));
        view.setUint8(1, 'I'.charCodeAt(0));
        view.setUint8(2, 'F'.charCodeAt(0));
        view.setUint8(3, 'F'.charCodeAt(0));
        view.setUint32(4, fileSize, true); // file size
        view.setUint8(8, 'W'.charCodeAt(0));
        view.setUint8(9, 'A'.charCodeAt(0));
        view.setUint8(10, 'V'.charCodeAt(0));
        view.setUint8(11, 'E'.charCodeAt(0));
        
        // "fmt " sub-chunk
        view.setUint8(12, 'f'.charCodeAt(0));
        view.setUint8(13, 'm'.charCodeAt(0));
        view.setUint8(14, 't'.charCodeAt(0));
        view.setUint8(15, ' '.charCodeAt(0));
        view.setUint32(16, 16, true); // size of fmt chunk
        view.setUint16(20, 1, true); // format = PCM
        view.setUint16(22, channels, true); // channels
        view.setUint32(24, sampleRate, true); // sample rate
        view.setUint32(28, sampleRate * bytesPerSample * channels, true); // byte rate
        view.setUint16(32, bytesPerSample * channels, true); // block align
        view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
        
        // "data" sub-chunk
        view.setUint8(36, 'd'.charCodeAt(0));
        view.setUint8(37, 'a'.charCodeAt(0));
        view.setUint8(38, 't'.charCodeAt(0));
        view.setUint8(39, 'a'.charCodeAt(0));
        view.setUint32(40, dataSize, true); // data size
        
        // Fill the rest with silence (128 = 0 level for 8-bit PCM)
        for (let i = 0; i < dataSize; i++) {
          view.setUint8(44 + i, 128);
        }
        
        // Create a test audio file
        testAudioFile = new File([buffer], 'test-silence.wav', { type: 'audio/wav' });
        console.log('Test audio file created successfully', {
          size: testAudioFile.size,
          type: testAudioFile.type,
          name: testAudioFile.name
        });
        
      } catch (error) {
        console.error('Error creating test audio file', error);
      }
    }
    
    if (!audioFile && !testAudioFile) {
      console.error('No audio file provided in request and test mode failed');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    // Use either the real audio file or the test file
    const effectiveAudioFile = audioFile || testAudioFile as File;
    
    console.log('Audio file ready for processing', {
      name: effectiveAudioFile.name,
      type: effectiveAudioFile.type,
      size: effectiveAudioFile.size,
      isTestFile: isTestMode && !audioFile,
      environment: process.env.NODE_ENV,
      formDataKeys: Array.from(formData.keys())
    });
    
    // Get webhook URL with fallback
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 
                       process.env.WEBHOOK_URL || 
                       'https://innovasense.app.n8n.cloud/webhook/lora/stt';
    
    console.log('Environment info', {
      webhookUrl,
      isVercel: process.env.VERCEL === '1',
      mockApi: process.env.NEXT_PUBLIC_MOCK_API,
      enableFallback: process.env.NEXT_PUBLIC_ENABLE_FALLBACK,
    });
    
    try {
      // Check if this is a test call to verify the environment
      if (formData.get('test') === 'true') {
        console.log('Test request detected, returning debug info');
        return NextResponse.json({
          success: true,
          message: "This is a test response to check webhook connectivity",
          environment: {
            isVercel: process.env.VERCEL === '1',
            webhookUrl: webhookUrl,
            audioSize: effectiveAudioFile?.size || 0,
            formData: Array.from(formData.keys())
          }
        });
      }
      
      // Check if fallback mode is explicitly enabled in the request
      const enableFallback = formData.get('enableFallback') === 'true';
      if (enableFallback) {
        console.log('Fallback mode enabled in request');
      }
      
      // Return fallback response if:
      // 1. MOCK_API is set
      // 2. We're in Vercel and either ENABLE_FALLBACK is true
      // 3. Fallback is explicitly requested in the form data
      const usesFallback = process.env.NEXT_PUBLIC_MOCK_API === 'true' || 
                         (process.env.VERCEL === '1' && process.env.NEXT_PUBLIC_ENABLE_FALLBACK === 'true') ||
                         enableFallback;
      
      if (usesFallback) {
        console.log('Using mock API response mode (fallback)', { reason: enableFallback ? 'user_requested' : 'environment_config' });
        
        // Create mock response with a 1-second delay to simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return NextResponse.json({
          success: true,
          message: "I'm your Real Estate AI assistant. I can help you find properties in Dubai based on your requirements. What are you looking for today?",
          isFallback: true
        });
      }
      
      // ------ DIFFERENT APPROACH FOR AUDIO FILE TRANSFER TO N8N ------
      
      // Use a longer timeout since we're in Edge Runtime
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout
      
      // Convert the File to an ArrayBuffer for binary transfer
      const audioArrayBuffer = await effectiveAudioFile.arrayBuffer();
      const audioBytes = new Uint8Array(audioArrayBuffer);
      
      // Get additional metadata from formData
      const sessionId = formData.get('sessionId') as string || '';
      const email = formData.get('email') as string || '';
      const domain = request.headers.get('host') || 'vercel';
      
      // For Vercel Edge runtime, let's use a more reliable approach for n8n
      // Create multipart/form-data manually since Edge runtime may have FormData limitations
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
      
      // Create parts for our multipart form
      const parts = [];
      
      // Add metadata parts
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="sessionId"\r\n\r\n${sessionId}\r\n`
      );
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="email"\r\n\r\n${email}\r\n`
      );
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="domain"\r\n\r\n${domain}\r\n`
      );
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="source"\r\n\r\nvercel-edge\r\n`
      );
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="vercelEnv"\r\n\r\n${process.env.VERCEL_ENV || 'unknown'}\r\n`
      );
      
      // Add explicit content for expected format
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="expectedFormat"\r\n\r\naudio\r\n`
      );
      
      // Add debug info for n8n
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="n8nWebhookInfo"\r\n\r\nThis request contains an 'audio' field as a binary file. If binary data is not detected, please check webhook settings: Enable 'Binary Data' option in webhook configuration.\r\n`
      );
      
      // Add the file part with the appropriate headers
      const fileName = effectiveAudioFile.name || 'audio.webm';
      const fileType = effectiveAudioFile.type || 'audio/webm';
      
      // Also include base64 representation as a fallback
      // Convert to base64 in chunks to avoid call stack issues with large files
      let base64Audio = '';
      const chunkSize = 1024; // Process 1KB at a time
      
      for (let i = 0; i < Math.min(audioBytes.length, 1024); i += chunkSize) {
        const chunk = audioBytes.slice(i, i + chunkSize);
        const binaryString = Array.from(chunk)
          .map(byte => String.fromCharCode(byte))
          .join('');
        base64Audio += btoa(binaryString);
        
        // Just get the first chunk for the sample
        if (base64Audio.length > 100) break;
      }
      
      // Add a debug part to help diagnose issues
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="debug"\r\n\r\ntrue\r\n`
      );
      
      // Add a metadata part with file info
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="fileInfo"\r\n\r\n${JSON.stringify({
          name: fileName,
          type: fileType,
          size: audioBytes.length
        })}\r\n`
      );
      
      // Add a fallback JSON representation of the audio as base64
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="audioBase64Fallback"\r\n\r\n${base64Audio.substring(0, 100)}...\r\n`
      );
      
      // Start the file part with the appropriate headers
      let filePart = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${fileName}"\r\nContent-Type: ${fileType}\r\n\r\n`;
      
      // Create binary arrays for each part
      const textEncoder = new TextEncoder();
      const textParts = parts.map(part => textEncoder.encode(part));
      const filePartHeader = textEncoder.encode(filePart);
      
      // Calculate total size for the complete request body
      const endBoundary = textEncoder.encode(`\r\n--${boundary}--\r\n`);
      let totalSize = textParts.reduce((acc, part) => acc + part.byteLength, 0);
      totalSize += filePartHeader.byteLength + audioBytes.byteLength + endBoundary.byteLength;
      
      // Create a single Uint8Array for the entire request
      const requestBody = new Uint8Array(totalSize);
      let offset = 0;
      
      // Add text parts to the request body
      for (const part of textParts) {
        requestBody.set(part, offset);
        offset += part.byteLength;
      }
      
      // Add file header
      requestBody.set(filePartHeader, offset);
      offset += filePartHeader.byteLength;
      
      // Add file data
      requestBody.set(audioBytes, offset);
      offset += audioBytes.byteLength;
      
      // Add final boundary
      requestBody.set(endBoundary, offset);
      
      console.log('Sending to n8n with manual multipart/form-data approach', {
        method: 'POST',
        webhook: webhookUrl,
        audioSize: audioBytes.length,
        fileName: fileName,
        contentType: fileType,
        boundaryUsed: boundary.substring(0, 10) + '...',
        formDataKeys: ['audio', 'sessionId', 'email', 'domain', 'source'],
        totalSize: totalSize
      });
      
      // Make the request with manually constructed multipart/form-data
      let response;
      try {
        response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Vercel Edge Function',
            'X-Source': 'Vercel-' + domain,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          body: requestBody,
          signal: controller.signal
        });
        
        // If response is not successful, throw an error to trigger the fallback
        if (!response.ok) {
          throw new Error(`Primary request failed with status ${response.status}`);
        }
      } catch (primaryError) {
        console.error('Primary request failed:', primaryError);
        
        // Only create and use fallback if primary fails
        if (process.env.VERCEL === '1' && process.env.NODE_ENV === 'production') {
          console.log('Primary request failed, using base64 JSON fallback method');
          
          try {
            // Convert to base64 in chunks to avoid call stack issues with large files
            let fullBase64Audio = '';
            const chunkSize = 1024; // Process 1KB at a time
            
            for (let i = 0; i < audioBytes.length; i += chunkSize) {
              const chunk = audioBytes.slice(i, i + chunkSize);
              const binaryString = Array.from(chunk)
                .map(byte => String.fromCharCode(byte))
                .join('');
              fullBase64Audio += btoa(binaryString);
            }
            
            // Create a JSON payload as fallback
            const jsonData = {
              sessionId,
              email,
              domain,
              requestFrom: 'vercel-edge-fallback',
              binaryAudio: true,
              audioData: fullBase64Audio,
              audioType: fileType,
              audioName: fileName,
              audioSize: audioBytes.length,
              isBase64Fallback: true
            };
            
            // Send fallback request
            const fallbackUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'mode=fallback';
            
            console.log('Sending fallback request to:', fallbackUrl);
            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Vercel Edge Function Fallback',
                'X-Source': 'Vercel-Fallback-' + domain
              },
              body: JSON.stringify(jsonData)
            });
            
            if (fallbackResponse.ok) {
              console.log('Fallback response received successfully');
              response = fallbackResponse;
            } else {
              console.error('Fallback request also failed with status:', fallbackResponse.status);
              throw primaryError; // Re-throw the original error if fallback also failed
            }
          } catch (fallbackError) {
            console.error('Error in fallback method:', fallbackError);
            throw primaryError; // Re-throw the original error
          }
        } else {
          throw primaryError;
        }
      }
      
      clearTimeout(timeoutId);
      
      // Get response details for debugging
      const responseHeaders = Object.fromEntries(response.headers.entries());
      
      console.log('Webhook response received', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });
      
      // Check if the response is successful
      if (!response.ok) {
        console.error('Webhook error:', response.status, 'Status text:', response.statusText);
        // Try to get more detailed error information
        try {
          const errorText = await response.text();
          console.error('Error response body:', errorText);
          
          // Try to parse as JSON for better error details
          try {
            const errorJson = JSON.parse(errorText);
            console.error('Error JSON:', errorJson);
          } catch (e) {
            // Not JSON, that's okay
          }
        } catch (readError) {
          console.error('Could not read error response:', readError);
        }
        
        // For Vercel deployment, automatically use fallback on webhook errors
        if (process.env.VERCEL === '1') {
          console.log('Webhook failed in Vercel - using fallback response');
          return NextResponse.json({
            success: true,
            message: "I'm your Real Estate AI assistant. There seems to be an issue connecting to our service, but I can still help you find properties in Dubai. What are you looking for today?",
            isFallback: true,
            webhookError: response.status
          });
        }
        
        // Return a more informative error
        return NextResponse.json(
          { 
            error: `Webhook returned status ${response.status}`,
            message: "The AI service is currently unavailable. Please try again later or enable fallback mode.",
            technical_detail: `Status: ${response.status}, StatusText: ${response.statusText}`
          },
          { status: 500 }
        );
      }
      
      // Get the content type to determine how to handle the response
      const contentType = response.headers.get('content-type') || '';
      console.log('Webhook response content type:', contentType);
      
      // For audio responses, pass through the binary data
      if (contentType.includes('audio/')) {
        console.log('Processing audio response');
        const audioBuffer = await response.arrayBuffer();
        console.log('Audio response size:', audioBuffer.byteLength);
        
        // Return the audio with explicit WebM content type regardless of what n8n returns
        return new NextResponse(audioBuffer, {
          headers: {
            'Content-Type': 'audio/webm',
          }
        });
      } 
      // For JSON responses
      else if (contentType.includes('application/json')) {
        console.log('Processing JSON response');
        try {
          const jsonData = await response.json();
          console.log('Webhook JSON response parsed successfully:', {
            success: jsonData.success,
            hasMessage: !!jsonData.message,
            messageLength: jsonData.message ? jsonData.message.length : 0,
            responseKeys: Object.keys(jsonData)
          });
          return NextResponse.json(jsonData);
        } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          // If JSON parsing fails, return a fallback response
          return NextResponse.json({ 
            success: true, 
            message: "I received your request, but had trouble processing the response. How can I help you with Dubai real estate today?",
            parseError: true
          });
        }
      } 
      // For text or other responses
      else {
        console.log('Processing text response');
        const textData = await response.text();
        console.log('Text response preview:', textData.substring(0, 100) + '...');
        
        try {
          // Try to parse as JSON in case content type header is incorrect
          const jsonData = JSON.parse(textData);
          console.log('Text response successfully parsed as JSON');
          return NextResponse.json(jsonData);
        } catch (e) {
          console.log('Response is not JSON, returning as text');
          // If not valid JSON, return as text
          return NextResponse.json({ 
            text: textData.substring(0, 500) + (textData.length > 500 ? '...' : ''),
            textResponse: true,
            message: "I received your request but the response format was unexpected. How can I help you with Dubai real estate today?"
          });
        }
      }
    } catch (error) {
      // Check if this is an abort error (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Request to webhook timed out');
        
        // In Vercel, use fallback on timeout
        if (process.env.VERCEL === '1') {
          return NextResponse.json({
            success: true,
            message: "I'm your Real Estate AI assistant. Our service is a bit slow right now, but I can still help you find properties in Dubai. What are you looking for today?",
            isFallback: true,
            reason: "timeout"
          });
        }
        
        return NextResponse.json(
          { 
            success: false,
            message: 'The AI service is taking too long to respond. Please try again later or enable fallback mode.',
            timeout: true
          },
          { status: 202 } // 202 Accepted
        );
      }
      
      console.error('Error forwarding to webhook:', error);
      
      // In Vercel, use fallback on connection errors
      if (process.env.VERCEL === '1') {
        return NextResponse.json({
          success: true,
          message: "I'm your Real Estate AI assistant. We're having connection issues, but I can still help you find properties in Dubai. What are you looking for today?",
          isFallback: true,
          reason: "connection_error",
          errorMessage: (error as Error).message
        });
      }
      
      return NextResponse.json(
        { 
          error: `Error connecting to AI service: ${(error as Error).message}`,
          message: "Please check your internet connection and try again, or enable fallback mode."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API route error:', error);
    
    // In Vercel, use fallback on internal errors
    if (process.env.VERCEL === '1') {
      return NextResponse.json({
        success: true,
        message: "I'm your Real Estate AI assistant. We encountered an internal error, but I can still help you find properties in Dubai. What are you looking for today?",
        isFallback: true,
        reason: "internal_error",
        errorMessage: (error as Error).message
      });
    }
    
    return NextResponse.json(
      { 
        error: `Internal server error: ${(error as Error).message}`,
        message: "An unexpected error occurred. Please try again later or enable fallback mode."
      },
      { status: 500 }
    );
  }
} 