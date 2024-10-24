import prisma from '@/app/api/utils/prisma';

// Function to create a message and save it to the database
export const createMessage = async (
  assistantId: string,
  threadId: string,
  msgId: string,
  buffer: string
) => {
  // Create the message object
  let object = {
    id: msgId,
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: {
          value: buffer,
          annotations: [],
        },
      },
    ],
    created_at: Math.floor(new Date().getTime() / 1000),
  };

  // Save the message to the database using upsert (create or update)
  let message = await prisma.message.upsert({
    where: {
      id: msgId,
    },
    update: {
      id: msgId,
      threadId: threadId,
      object: object,
    },
    create: {
      id: msgId,
      threadId: threadId,
      object: object,
    },
  });

  // Add a metric event for message creation
  await prisma.metric.create({
    data: {
      assistantId: assistantId ? assistantId : 'unknown', // Use 'unknown' if assistantId is not provided
      name: 'MESSAGE_CREATED',
      value: 1,
      time: new Date(message.created_at), // Use the message creation time
      tags: message as any, // Store the message as tags
    },
  });
};

// Function to get messages from the database
export const getMessages = async (threadId: string, after?: string | null) => {
  let messages = [];
  if (after) {
    // Fetch messages after a specific message ID
    let messages = await prisma.message.findMany({
      take: 1,
      skip: 1,
      cursor: {
        id: after,
      },
      where: {
        threadId: threadId,
      },
      select: {
        object: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Return the messages' objects
    return messages.map((item) => item.object);
  } else {
    // Fetch all messages for a specific thread ID
    let messages = await prisma.message.findMany({
      where: {
        threadId: threadId,
      },
      select: {
        object: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Return the messages' objects
    return messages.map((item) => item.object);
  }
};
