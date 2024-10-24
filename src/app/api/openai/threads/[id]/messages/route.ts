import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIObjectForAssistant } from '@/app/api/openai/util';
import { getMessages } from '@/app/api/utils/messages';
import prisma from '@/app/api/utils/prisma';

// Function to extract the thread ID from the request URL
const getId = (req: Request) => {
  const url = new URL(req.url);
  return url.pathname.split('/').splice(-2, 1)[0];
};

// Handler for GET requests to fetch messages for a specific thread
export async function GET(req: NextRequest, res: NextResponse) {
  try {
    // Extract the thread ID from the request
    let threadId = getId(req);
    // Get the 'after' parameter from the query string
    let after = req.nextUrl.searchParams.get('after');
    if (after) {
      after = after.trim();
    }
    // Fetch messages for the thread, optionally after a specific message
    let messages = await getMessages(threadId, after);
    // Return the messages in the response with status 200
    return Response.json({ data: messages }, { status: 200 });
  } catch (err: any) {
    // Log the error and return an error response with the error message and status
    console.log(err);
    return Response.json({ message: err.message }, { status: err.status });
  }
}

// Handler for POST requests to create a new message in a specific thread
export async function POST(req: NextRequest, res: NextResponse) {
  try {
    // Parse the request body
    const body = await req.json();
    // Extract the thread ID from the request
    let threadId = getId(req);
    // Get the OpenAI object for the assistant
    const openai = (await getOpenAIObjectForAssistant(req)) as OpenAI;
    // Get the assistant ID from the request headers
    let assistantId = req.headers.get('X-Assistant-Id');

    // Construct the message object from the request body
    let message = {
      role: body.message.role,
      content: body.message.content[0].text.value,
    };

    try {
      // Create a new message using OpenAI API
      let createMessageResponse = await openai.beta.threads.messages.create(
        threadId,
        message
      );

      // Save the message information to the database using upsert (create or update)
      await prisma.message.upsert({
        where: {
          id: createMessageResponse.id,
        },
        update: {
          id: createMessageResponse.id,
          threadId: threadId,
          object: createMessageResponse as any,
        },
        create: {
          id: createMessageResponse.id,
          threadId: threadId,
          object: createMessageResponse as any,
        },
      });

      // Add a metric event for message creation
      await prisma.metric.create({
        data: {
          assistantId: assistantId ? assistantId : 'unknown', // Use 'unknown' if assistantId is not provided
          name: 'MESSAGE_CREATED',
          value: 1,
          tags: createMessageResponse as any, // Store the message response as tags
        },
      });

      // Return the created message response with status 201
      return Response.json(createMessageResponse, { status: 201 });
    } catch (err: any) {
      // Log the error and return an error response with the error message and status
      console.log(err);
      return Response.json({ message: err.message }, { status: err.status });
    }
  } catch (err: any) {
    // Log the error and return an error response with the error message and status
    console.log(err);
    return Response.json({ message: err.message }, { status: err.status });
  }
}
