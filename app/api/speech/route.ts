import { NextRequest, NextResponse } from 'next/server';

// Use Edge Runtime for longer execution time
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    console.log('Speech API route called');
    
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
      size: audioFile.size
    });
    
    // Create a new FormData to forward to the webhook
    const forwardFormData = new FormData();
    forwardFormData.append('audio', audioFile, 'audio.webm');
    
    // Forward session ID if provided
    const sessionId = formData.get('sessionId');
    if (sessionId) {
      forwardFormData.append('sessionId', sessionId as string);
      console.log('Forwarding session ID:', sessionId);
    }
    
    // Forward email if provided
    const email = formData.get('email');
    if (email) {
      forwardFormData.append('email', email as string);
      console.log('Forwarding email:', email);
    }
    
    // Get webhook URL with fallback
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 
                       process.env.WEBHOOK_URL || 
                       'https://innovasense.app.n8n.cloud/webhook/lora/stt';
    
    console.log('Forwarding request to webhook:', webhookUrl);
    
    try {
      // Use a longer timeout since we're in Edge Runtime
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout
      
      console.log('Attempting to fetch from webhook with URL:', webhookUrl);
      
      // Return fallback response if we're in development and MOCK_API is set
      if (process.env.NEXT_PUBLIC_MOCK_API === 'true') {
        console.log('Using mock API response for development');
        clearTimeout(timeoutId);
        return NextResponse.json({
          success: true,
          message: "This is a mock response for development. In production, this would connect to the actual AI service."
        });
      }
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: forwardFormData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if the response is successful
      if (!response.ok) {
        console.error('Webhook error:', response.status, 'Status text:', response.statusText);
        try {
          // Try to get more error details
          const errorText = await response.text();
          console.error('Error response body:', errorText);
        } catch (readError) {
          console.error('Could not read error response:', readError);
        }
        
        // Return a more informative error
        return NextResponse.json(
          { 
            error: `Webhook returned status ${response.status}`,
            message: "The AI service is currently unavailable. Please try again later.",
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
        const jsonData = await response.json();
        return NextResponse.json(jsonData);
      } 
      // For text or other responses
      else {
        console.log('Processing text response');
        const textData = await response.text();
        return NextResponse.json({ text: textData });
      }
    } catch (error) {
      // Check if this is an abort error (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Request to webhook timed out');
        return NextResponse.json(
          { 
            success: false,
            message: 'The AI service is taking too long to respond. Please try again later.',
            timeout: true
          },
          { status: 202 } // 202 Accepted
        );
      }
      
      console.error('Error forwarding to webhook:', error);
      return NextResponse.json(
        { 
          error: `Error connecting to AI service: ${(error as Error).message}`,
          message: "Please check your internet connection and try again."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: `Internal server error: ${(error as Error).message}`,
        message: "An unexpected error occurred. Please try again later."
      },
      { status: 500 }
    );
  }
} 