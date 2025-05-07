import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    console.log('Webhook API route called');
    
    // Get the form data from the request
    const formData = await request.formData();
    
    // Log that we received the request
    console.log('Received request in webhook API route');
    
    // Use environment variable with better fallbacks
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 
                      process.env.WEBHOOK_URL || 
                      'https://innovasense.app.n8n.cloud/webhook/lora/stt';
    
    console.log('Using webhook URL:', webhookUrl);
    
    // Check if fallback mode is explicitly enabled in the request
    const enableFallback = formData.get('enableFallback') === 'true';
    if (enableFallback) {
      console.log('Fallback mode enabled in request');
    }
    
    // Return mock response for development if configured
    if (process.env.NEXT_PUBLIC_MOCK_API === 'true' || 
        (process.env.VERCEL === '1' && process.env.NEXT_PUBLIC_ENABLE_FALLBACK === 'true') ||
        enableFallback) {
      console.log('Using mock API response mode');
      
      // Create mock response with a 1-second delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return NextResponse.json({
        success: true,
        message: "I'm your Real Estate AI assistant. I can help you find properties in Dubai based on your requirements. What are you looking for today?"
      });
    }
    
    // Forward the request to the n8n webhook
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Log the response status
    console.log('Webhook response status:', response.status);
    
    // If the response is not ok, log and return an error
    if (!response.ok) {
      console.error('Webhook error response:', response.status, response.statusText);
      try {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
      } catch (readError) {
        console.error('Could not read error response body:', readError);
      }
      
      return NextResponse.json({
        error: `Webhook service returned an error: ${response.status}`,
        message: "The service is currently unavailable. Please try again later."
      }, { status: 500 });
    }
    
    // Check the content type of the response
    const contentType = response.headers.get('Content-Type') || '';
    console.log('Response content type:', contentType);
    
    // If it's a binary audio file
    if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
      console.log('Processing audio response');
      // Get the binary data
      const audioBuffer = await response.arrayBuffer();
      console.log('Audio response size:', audioBuffer.byteLength);
      
      // Return the binary data with the correct content type
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg', // Use standard format that iOS supports
          'X-Content-Type-Options': 'nosniff' // Prevent browser from sniffing content type
        },
      });
    } 
    
    // For JSON or text responses
    const data = await response.text();
    console.log('Processing text/JSON response');
    
    // Try to parse as JSON first
    try {
      const jsonData = JSON.parse(data);
      return NextResponse.json(jsonData);
    } catch (e) {
      console.log('Response is not valid JSON, returning as text');
      // Return the response as text if it's not valid JSON
      return new NextResponse(data, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        },
      });
    }
  } catch (error) {
    // Check if it's a timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Request to webhook timed out');
      return NextResponse.json({ 
        error: 'Request timed out',
        message: 'The service is taking too long to respond. Please try again later.'
      }, { status: 500 });
    }
    
    console.error('Error in webhook proxy:', error);
    return NextResponse.json({ 
      error: `Error processing request: ${(error as Error).message}`,
      message: 'An unexpected error occurred. Please try again later.'
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 