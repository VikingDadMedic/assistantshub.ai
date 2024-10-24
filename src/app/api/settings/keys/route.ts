import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import prisma from '@/app/api/utils/prisma';

// Handler for GET requests to fetch model provider keys
export async function GET(req: NextRequest, res: NextResponse) {
  // Get the current session
  const session = await getSession();

  // Check if the user is authenticated
  if (session?.user) {
    // Fetch model provider keys for the authenticated user
    let keys = await prisma.modelProviderKey.findMany({
      where: {
        organizationOwner: session?.user.sub,
        organizationOwnerType: 'personal',
      },
      select: {
        id: true,
        name: true,
        modelProviderId: true,
      },
    });
    // Return the keys in the response with status 200
    return Response.json(keys, { status: 200 });
  } else {
    // Return an error response if the user is not authenticated
    return Response.json({ message: 'Unauthenticated' }, { status: 401 });
  }
}

// Handler for POST requests to create or update a model provider key
export async function POST(req: NextRequest, res: NextResponse) {
  // Get the current session
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

      // Create or update the model provider key
      let key = await prisma.modelProviderKey.upsert({
        where: {
          id: body.id,
        },
        update: {
          id: body.id,
          name: body.name,
          key: body.key,
          organizationOwner: session?.user.sub,
          organizationOwnerType: 'personal',
          modelProviderId: body.modelProviderId,
        },
        create: {
          id: body.id,
          name: body.name,
          key: body.key,
          organizationOwner: session?.user.sub,
          organizationOwnerType: 'personal',
          modelProviderId: body.modelProviderId,
        },
      });

      // Return the created or updated key in the response with status 201
      return Response.json(key, { status: 201 });
    } else {
      // Return an error response if the organization is invalid
      return Response.json(
        { message: 'Invalid organization' },
        { status: 401 }
      );
    }
  } else {
    // Return an error response if the user is not authenticated
    return Response.json({ message: 'Unauthenticated' }, { status: 401 });
  }
}
