import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulidx';
import prisma from '@/app/api/utils/prisma';
import { getSession } from '@auth0/nextjs-auth0';
import { getOpenAIWithKey } from '@/app/api/utils/openai';

// Handler for GET requests to fetch assistants for the authenticated user
export async function GET(req: NextRequest, res: NextResponse) {
  // Get the session information
  const session = await getSession();

  // Check if the user is authenticated
  if (session?.user) {
    // Fetch assistants for the authenticated user
    let assistants = await prisma.assistant.findMany({
      where: {
        organizationOwner: session?.user.sub,
        organizationOwnerType: 'personal',
      },
      select: {
        id: true,
        object: true,
        avatar: true,
        profile: true,
        modelId: true,
        published: true,
        authenticatedUsersOnly: true,
      },
    });

    // Map the assistants to include additional properties
    let assistantsCollection = assistants.map((assistant) => {
      if (assistant.object) {
        // @ts-ignore
        assistant.object.profile = assistant.profile;
        // @ts-ignore
        assistant.object.modelId = assistant.modelId;
        // @ts-ignore
        assistant.object.published = assistant.published;
        // @ts-ignore
        assistant.object.avatar = assistant.avatar;
        // @ts-ignore
        assistant.object.authenticatedUsersOnly =
          assistant.authenticatedUsersOnly;
      }
      return assistant.object;
    });

    // Return the assistants in the response with status 200
    return Response.json(assistantsCollection, { status: 200 });
  } else {
    // Not Signed in
    return Response.json({ message: 'Unauthenticated' }, { status: 401 });
  }
}

// Handler for POST requests to create a new assistant
export async function POST(req: NextRequest, res: NextResponse) {
  // Get the session information
  const session = await getSession();

  // Check if the user is authenticated
  if (session?.user) {
    // Fetch the organization for the authenticated user
    let organization = await prisma.organization.findFirst({
      where: {
        owner: session?.user.sub,
        ownerType: 'personal',
      },
    });

    // Check if the organization exists
    if (organization) {
      // Parse the request body
      const body = await req.json();

      // Extract and delete model-related properties from the request body
      let modelId = body.modelId;
      delete body.modelId;

      let modelProviderId = body.modelProviderId;
      delete body.modelProviderId;

      let modelProviderKeyId = body.modelProviderKeyId;
      delete body.modelProviderKeyId;

      try {
        let createResponse = null;

        // Check if the model provider is OpenAI
        if (modelProviderId === 'openai') {
          // Get the OpenAI object with the provided key
          const openai = await getOpenAIWithKey(modelProviderKeyId);

          // Set the model in the request body
          body.model = modelId;

          // Create a new assistant using OpenAI API
          createResponse = await openai.beta.assistants.create(body);
        } else {
          // For other providers, store the assistant information directly in the database
          createResponse = body;
          createResponse.id = 'asst_g' + ulid();
        }

        // Save the assistant information to the database using upsert (create or update)
        await prisma.assistant.upsert({
          where: {
            id: createResponse.id,
          },
          update: {
            id: createResponse.id,
            organizationOwner: session?.user.sub,
            organizationOwnerType: 'personal',
            object: createResponse as any,
            modelId: modelId,
            modelProviderId: modelProviderId,
            modelProviderKeyId: modelProviderKeyId,
          },
          create: {
            id: createResponse.id,
            modelId: modelId,
            modelProviderId: modelProviderId,
            modelProviderKeyId: modelProviderKeyId,
            organizationOwner: session?.user.sub,
            organizationOwnerType: 'personal',
            object: createResponse as any,
            published: true,
          },
        });

        // Return the created assistant in the response with status 201
        return Response.json(createResponse, { status: 201 });
      } catch (err: any) {
        // Log the error and return an error response with the error message and status
        console.log(err);
        return Response.json({ message: err.message }, { status: err.status });
      }
    } else {
      // Return an error response if the organization does not exist
      return Response.json(
        { message: 'OpenAI API Key does not exist' },
        { status: 400 }
      );
    }
  } else {
    // Not Signed in
    return Response.json({ message: 'Unauthenticated' }, { status: 401 });
  }
}
