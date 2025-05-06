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
    
    if (!audioFile) {
      console.error('No audio file provided in request');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    console.log('Audio file received', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
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
            audioSize: audioFile?.size || 0,
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
      const audioArrayBuffer = await audioFile.arrayBuffer();
      const audioBytes = new Uint8Array(audioArrayBuffer);
      
      // Get additional metadata from formData
      const sessionId = formData.get('sessionId') as string || '';
      const email = formData.get('email') as string || '';
      const domain = request.headers.get('host') || 'vercel';
      
      // Create a proper FormData object to send a multipart/form-data request to n8n
      // n8n expects binary files to be sent as proper multipart/form-data
      const formDataToSend = new FormData();
      
      // Create a new File object from the audio data with explicit filename and type
      const fileToSend = new File(
        [audioBytes], 
        audioFile.name || 'audio.webm',  // Ensure we have a filename
        { type: audioFile.type || 'audio/webm' }  // Ensure we have a content type
      );
      
      // Add the file as 'audio' which is what n8n is expecting
      formDataToSend.append('audio', fileToSend);
      
      // Add metadata
      formDataToSend.append('sessionId', sessionId);
      formDataToSend.append('email', email);
      formDataToSend.append('domain', domain);
      formDataToSend.append('source', 'vercel-edge');
      
      console.log('Sending to n8n with multipart/form-data approach', {
        method: 'POST',
        webhook: webhookUrl,
        audioSize: fileToSend.size,
        fileName: fileToSend.name,
        contentType: fileToSend.type,
        formDataKeys: ['audio', 'sessionId', 'email', 'domain', 'source']
      });
      
      // Make the request with proper multipart/form-data
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Vercel Edge Function',
          'X-Source': 'Vercel-' + domain
          // Don't set Content-Type manually, let the browser set it with boundary
        },
        body: formDataToSend,
        signal: controller.signal
      });
      
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
        
        // Return the audio with safe headers
        return new NextResponse(audioBuffer, {
          headers: {
            'Content-Type': contentType,
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