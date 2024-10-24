import OpenAI from 'openai';
import prisma from '@/app/api/utils/prisma';

// Function to get an instance of OpenAI using the assistant's model provider key or environment variable
export function getOpenAI(assistant: any): OpenAI {
  // Initialize the OpenAI API key from environment variable
  let openAIAPIKey = process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY
    : null;

  // Override the API key if the assistant has a model provider key
  if (assistant.modelProviderKey) {
    openAIAPIKey = assistant.modelProviderKey.key['apiKey'];
  }

  // Throw an error if the API key is missing
  if (!openAIAPIKey) {
    throw new Error('OpenAI API key is missing');
  }

  // Return a new instance of OpenAI with the API key
  return new OpenAI({
    apiKey: openAIAPIKey,
  });
}

// Function to get an instance of OpenAI using a model provider key ID or environment variable
export async function getOpenAIWithKey(modelProviderKeyId: string) {
  // Initialize the OpenAI API key from environment variable
  let openAIAPIKey = process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY
    : null;

  // If a model provider key ID is provided, fetch the corresponding key from the database
  if (modelProviderKeyId) {
    let modelProviderKey = await prisma.modelProviderKey.findFirst({
      where: {
        id: modelProviderKeyId,
      },
      select: {
        id: true,
        name: true,
        key: true,
      },
    });

    // Override the API key if the model provider key is found
    if (modelProviderKey && modelProviderKey.key) {
      // @ts-ignore
      openAIAPIKey = modelProviderKey.key['apiKey'];
    }
  }

  // Throw an error if the API key is missing
  if (!openAIAPIKey) {
    throw new Error('OpenAI API key missing');
  }

  // Return a new instance of OpenAI with the API key
  return new OpenAI({
    apiKey: openAIAPIKey,
  });
}
