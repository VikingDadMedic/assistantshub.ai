import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { geolocation } from '@vercel/edge';
import { getOpenAIObjectForAssistant } from '@/app/api/openai/util';
import prisma from '@/app/api/utils/prisma';

export async function POST(req: NextRequest, res: NextResponse) {
  try {
    // Extract geolocation information from the request
    const { city, country, region } = geolocation(req);
    // Get the OpenAI object for the assistant
    const openai = (await getOpenAIObjectForAssistant(req)) as OpenAI;

    // Get the assistant ID from the request headers
    let assistantId = req.headers.get('X-Assistant-Id');

    // Initialize metadata object
    let metadata: any = {};
    // Get the fingerprint from the request headers
    let fingerprint = req.headers.get('X-Fingerprint');
    if (fingerprint) {
      metadata['fingerprint'] = fingerprint;
    }

    // Add geolocation information to metadata if available
    if (city) {
      metadata['city'] = city;
    }
    if (country) {
      metadata['country'] = country;
    }
    if (region) {
      metadata['region'] = region;
    }

    try {
      // Create a new thread using OpenAI API with the metadata
      let createThreadResponse = await openai.beta.threads.create({
        metadata: metadata,
      });

      // Save the thread information to the database using upsert (create or update)
      await prisma.thread.upsert({
        where: {
          id: createThreadResponse.id,
        },
        update: {
          id: createThreadResponse.id,
          assistantId: assistantId,
          object: createThreadResponse as any,
        },
        create: {
          id: createThreadResponse.id,
          assistantId: assistantId,
          object: createThreadResponse as any,
        },
      });

      // Add a metric event for thread creation
      await prisma.metric.create({
        data: {
          assistantId: assistantId ? assistantId : 'unknown', // Use 'unknown' if assistantId is not provided
          name: 'THREAD_CREATED',
          value: 1,
          tags: createThreadResponse as any, // Store the thread response as tags
        },
      });

      // Return the created thread response with status 201
      return Response.json(createThreadResponse, { status: 201 });
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
