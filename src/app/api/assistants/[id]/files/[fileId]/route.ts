import { NextRequest, NextResponse } from 'next/server';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import prisma from '@/app/api/utils/prisma';
import { getSession } from '@auth0/nextjs-auth0';
import { getOpenAI } from '@/app/api/utils/openai';

// Function to extract the assistant ID from the request URL
const getId = (req: Request) => {
  const url = new URL(req.url);
  return url.pathname.split('/').splice(-3, 1)[0];
};

// Function to extract the file ID from the request URL
const getFileId = (req: Request) => {
  const url = new URL(req.url);
  return url.pathname.split('/').splice(-1, 1)[0];
};

// Function to fetch assistant details from the database
const getAssistant = async (id: string) => {
  return await prisma.assistant.findFirst({
    where: {
      id: id,
    },
    include: {
      organization: true,
      Folder: true,
    },
  });
};

// Function to validate the incoming token to ensure the user is authorized
const validateIncomingToken = async (token: any, assistant: any) => {
  return !(token === null || assistant.organization.owner !== token.sub);
};

// Function to create a presigned URL for downloading a file from S3
const createPresignedGet = async (
  file: string,
  expires: number = 3600
): Promise<string> => {
  let configuration = { region: process.env.AWS_REGION };
  // @ts-ignore
  const s3Client = new S3Client(configuration);

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: file,
  });

  try {
    // @ts-ignore
    return await getSignedUrl(s3Client, command, { expiresIn: expires });
  } catch (err) {
    console.error('Error creating presigned URL:', err);
    throw new Error('Failed to create presigned URL');
  }
};

// Function to delete a file from S3
async function deleteFileFromS3(file: string): Promise<any> {
  let configuration = { region: process.env.AWS_REGION };
  // @ts-ignore
  const s3Client = new S3Client(configuration);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: file,
  });

  try {
    // @ts-ignore
    return await s3Client.send(deleteCommand as any);
  } catch (error) {
    console.error('Failed to delete file from S3:', error);
    throw error; // Rethrowing the error is useful if you need to handle it further up the chain.
  }
}

// Handler for GET requests to fetch a file
export async function GET(req: NextRequest, res: NextResponse) {
  // Extract assistant ID from the request
  let assistantId = getId(req);

  // Fetch assistant details from the database
  let assistant = await getAssistant(assistantId);
  if (!assistant) {
    return Response.json(
      { message: 'Assistant does not exist' },
      { status: 404 }
    );
  }

  // Extract file ID from the request
  let fileId = getFileId(req);
  // Get the user session
  let session = await getSession();

  // Validate the incoming token to ensure the user is authorized
  if (!(await validateIncomingToken(session?.user, assistant))) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch file details from the database
    let file = await prisma.file.findFirst({
      where: {
        id: fileId,
      },
    });

    if (!file) {
      return Response.json({ message: 'File not found' }, { status: 404 });
    }
    // Generate the file name with extension
    let fileName = file.id + path.extname(file.originalFileName);
    // @ts-ignore
    file.downloadUrl = await createPresignedGet(fileName.trim());

    return Response.json(file, { status: 200 });
  } catch (err) {
    console.log(err);
    return Response.json({ message: 'File not found' }, { status: 404 });
  }
}

// Handler for DELETE requests to delete a file
export async function DELETE(req: NextRequest, res: NextResponse) {
  // Extract assistant ID from the request
  let assistantId = getId(req);
  // Fetch assistant details from the database
  let assistant = await getAssistant(assistantId);
  if (!assistant) {
    return Response.json(
      { message: 'Assistant does not exist' },
      { status: 404 }
    );
  }

  // Extract file ID from the request
  let fileId = getFileId(req);
  // Get the user session
  let session = await getSession();

  // Validate the incoming token to ensure the user is authorized
  if (!(await validateIncomingToken(session?.user, assistant))) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch file details from the database
    let file = await prisma.file.findFirst({
      where: {
        id: fileId,
      },
      select: {
        id: true,
        originalFileName: true,
        object: true,
        folder: true,
      },
    });

    if (!file) {
      return Response.json({ message: 'File not found' }, { status: 404 });
    }

    if (assistant?.modelProviderId === 'openai') {
      let openai = getOpenAI(assistant);
      try {
        // 1. Remove file from Vector Store
        // @ts-ignore
        let vectorStoreFileResponse = await openai.beta.vectorStores.files.del(
          // @ts-ignore
          file.folder.object.id,
          // @ts-ignore
          file.object.id
        );
      } catch (err) {
        console.error('Error removing file from Vector Store:', err);
      }

      try {
        // 2. Delete file from Open AI
        // @ts-ignore
        let filesResponse = await openai.files.del(file.object.id);
      } catch (err) {
        console.error('Error removing file from OpenAI:', err);
      }
    }
    // 3. Delete file from S3
    let fileName = file.id + path.extname(file.originalFileName);
    let s3Response = await deleteFileFromS3(fileName.trim());

    // 4. Remove file from DB
    await prisma.file.delete({
      where: {
        id: fileId,
      },
    });

    return Response.json(file, { status: 200 });
  } catch (err) {
    console.log(err);
    return Response.json({ message: 'File not found' }, { status: 404 });
  }
}
