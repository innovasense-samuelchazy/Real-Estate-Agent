import { NextRequest, NextResponse } from 'next/server';

// Use Edge Runtime for longer execution time
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    
    // Get the audio blob
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
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
    
    // Forward the request to the webhook
    const webhookUrl = process.env.WEBHOOK_URL || 'https://innovasense.app.n8n.cloud/webhook/lora/stt';
    
    console.log('Forwarding request to webhook:', webhookUrl);
    
    try {
      // Use a longer timeout since we're in Edge Runtime
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout
      
      console.log('Attempting to fetch from webhook with URL:', webhookUrl);
      
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
        
        return NextResponse.json(
          { error: `Webhook returned status ${response.status}` },
          { status: response.status }
        );
      }
      
      // Get the content type to determine how to handle the response
      const contentType = response.headers.get('content-type') || '';
      
      // For audio responses, pass through the binary data
      if (contentType.includes('audio/')) {
        const audioBuffer = await response.arrayBuffer();
        
        // Return the audio with safe headers
        return new NextResponse(audioBuffer, {
          headers: {
            'Content-Type': contentType,
          }
        });
      } 
      // For JSON responses
      else if (contentType.includes('application/json')) {
        const jsonData = await response.json();
        return NextResponse.json(jsonData);
      } 
      // For text or other responses
      else {
        const textData = await response.text();
        return NextResponse.json({ text: textData });
      }
    } catch (error) {
      // Check if this is an abort error (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Request to webhook timed out');
        return NextResponse.json(
          { 
            success: true,
            message: 'Your message is being processed in the background. Please wait a moment for the response.',
            timeout: true
          },
          { status: 202 } // 202 Accepted
        );
      }
      
      console.error('Error forwarding to webhook:', error);
      return NextResponse.json(
        { error: `Error forwarding to webhook: ${(error as Error).message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 