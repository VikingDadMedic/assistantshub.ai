import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { Stream } from 'openai/streaming';
import { ulid } from 'ulidx';
import { createMessage } from '@/app/api/utils/messages';
import { getOpenAIObjectForAssistant } from '@/app/api/openai/util';

// Function to extract the thread ID from the request URL
const getId = (req: Request) => {
  const url = new URL(req.url);
  return url.pathname.split('/').splice(-2, 1)[0];
};

export async function POST(req: NextRequest, res: NextResponse) {
  try {
    // Extract the thread ID from the request
    let threadId = getId(req);
    // Get the assistant ID from the request headers
    let assistantId = req.headers.get('X-Assistant-Id');
    // Get the OpenAI object for the assistant
    const openai = (await getOpenAIObjectForAssistant(req)) as OpenAI;

    // Create a new run using OpenAI API with streaming enabled
    const runResponse: Stream<any> = await openai.beta.threads.runs.create(
      threadId,
      { assistant_id: assistantId ? assistantId : '', stream: true }
    );

    // Generate a unique message ID
    let msgId = 'msg_' + ulid();
    // Initialize a buffer to store the message content
    let buffer = '';
    // Create a readable stream to process the events from the run response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let completed = false;
          // Iterate over the events from the run response
          for await (const event of runResponse) {
            // If the event is a message delta, append the content to the buffer and enqueue it to the stream
            if (event.event === 'thread.message.delta') {
              let data = event.data.delta.content[0].text.value;
              buffer += data;
              controller.enqueue(data);
            }

            // If the event indicates the run is completed, set the completed flag to true
            if (event.event === 'thread.run.completed') {
              completed = true;
            }
          }
          // If the run is completed, create a new message with the accumulated content
          if (completed) {
            await createMessage(
              assistantId ? assistantId : '',
              threadId,
              msgId,
              buffer
            );
          }
        } catch (error) {
          // If an error occurs, report it to the stream controller
          controller.error(error);
        }
        // Close the stream controller
        controller.close();
      },
    });

    // Return the stream as the response
    return new Response(stream);
  } catch (err: any) {
    // Log the error and return an error response with the error message and status
    console.log(err);
    return Response.json({ message: err.message }, { status: err.status });
  }
}
