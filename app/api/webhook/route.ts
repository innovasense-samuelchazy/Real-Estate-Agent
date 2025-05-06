import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    
    // Log that we received the request
    console.log('Received request in API route, forwarding to n8n webhook');
    
    // Use environment variable with fallback
    const webhookUrl = process.env.WEBHOOK_URL || 'https://innovasense.app.n8n.cloud/webhook/lora/stt';
    
    console.log('Using webhook URL:', webhookUrl);
    
    // Forward the request to the n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });
    
    // Log the response status
    console.log('n8n webhook response status:', response.status);
    
    // Check the content type of the response
    const contentType = response.headers.get('Content-Type') || '';
    console.log('Response content type:', contentType);
    
    // If it's a binary audio file
    if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
      // Get the binary data
      const audioBuffer = await response.arrayBuffer();
      
      // Return the binary data with the correct content type
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
        },
      });
    } 
    
    // For JSON or text responses
    const data = await response.text();
    console.log('n8n webhook response data:', data);
    
    // Return the response
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
      },
    });
  } catch (error) {
    console.error('Error in webhook proxy:', error);
    return new NextResponse(JSON.stringify({ error: 'Error processing request' }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 