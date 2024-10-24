import { ulid } from 'ulidx';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import Busboy from '@fastify/busboy';
import { Readable } from 'node:stream';
import prisma from '@/app/api/utils/prisma';
import { getSession } from '@auth0/nextjs-auth0';
import { getOpenAI } from '@/app/api/utils/openai';

// Utility function to convert ReadableStream to Node.js Stream
function toNodeReadable(readable: any) {
  return Readable.from(readable);
}

// Extract assistant ID from the request URL
const getId = (req: Request) => {
  const url = new URL(req.url);
  return url.pathname.split('/').splice(-2, 1)[0];
};

// Fetch assistant details from the database
const getAssistant = async (id: string) => {
  return await prisma.assistant.findFirst({
    where: {
      id: id,
    },
    include: {
      organization: true,
      Folder: true,
      modelProviderKey: true,
    },
  });
};

// Get the requested folder from the request headers
const getRequestedFolder = (req: Request) => {
  // TODO: When there are future folders, we can optionally get them from the folderId
  let requestedFolder = req.headers.get('X-Folder');

  // Get the folder from the header if specified
  if (!requestedFolder) requestedFolder = 'default';

  return requestedFolder;
};

// Validate the incoming token to ensure the user is authorized
const validateIncomingToken = async (user: any, assistant: any) => {
  return !(user === null || assistant.organization.owner !== user.sub);
};

// Handle POST request to upload a file
export async function POST(req: NextRequest, res: Response) {
  // Get the user session
  const session = await getSession();
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

  // Validate the incoming token
  if (!(await validateIncomingToken(session?.user, assistant))) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Get the requested folder from the request headers
  let requestedFolder = getRequestedFolder(req);

  let folder: any = null;
  // Find the folder in the assistant's folders
  assistant.Folder.map((item: any) => {
    if (item.name === requestedFolder) {
      folder = item;
    }
  });

  // No folders exist, create a default folder
  if (!assistant.Folder || !assistant.Folder.length) {
    let folderId = ulid();
    let openai = getOpenAI(assistant);

    let createStoreResponse = {};
    if (assistant.modelProviderId === 'openai') {
      // create associated vector store
      createStoreResponse = await openai.beta.vectorStores.create({
        name: folderId,
      });

      // @ts-ignore
      let updatePayload = {
        tools: [{ type: 'file_search' }],
        tool_resources: {
          // @ts-ignore
          file_search: { vector_store_ids: [createStoreResponse.id] },
        },
      };
      // attach vector store to the assistant
      await openai.beta.assistants.update(assistant.id, updatePayload as any);
    }

    // Create the folder mapped to the vector store
    folder = await prisma.folder.create({
      data: {
        id: folderId,
        name: 'default',
        type: 'documents',
        object: createStoreResponse,
        status: 'processing',
        assistantId: assistant.id,
      },
    });
  }

  // Generate a unique file ID
  let fileId = 'file_' + ulid();

  // Extract headers from the request
  let headers = {};
  req.headers.forEach((value: string, key: string, parent) => {
    // @ts-ignore
    headers[key] = value;
  });

  // Initialize Busboy for file upload handling
  const busboy = new Busboy({ headers: headers } as any);
  let file = {};
  let uploadedFile: any;
  busboy.on(
    'file',
    (
      fieldName: string,
      file: any,
      filename: string,
      encoding: string,
      mimetype: string
    ) => {
      // Create a temporary file path
      let tmpFileName = fileId + path.extname(filename).trim();
      const filePath = path.join(os.tmpdir(), tmpFileName);
      const writeStream = fs.createWriteStream(filePath);

      // Pipe the incoming file stream into the file write stream
      file.pipe(writeStream);
      uploadedFile = {
        fieldName,
        filename: tmpFileName,
        originalFileName: filename,
        encoding,
        mimetype,
        filePath,
      };

      writeStream.on('close', async () => {
        console.log(
          `File [${filename}] uploaded to temporary storage: ${filePath}`
        );
      });
    }
  );

  // Convert the request body to a Node.js readable stream and pipe it to Busboy
  const nodeReadable = toNodeReadable(req.body);
  nodeReadable.pipe(busboy);

  // Return a promise that resolves when the file upload is finished
  return new Promise<Response>((resolve) => {
    busboy.on('finish', async () => {
      if (uploadedFile) {
        try {
          // Create a read stream from the saved file
          const readStream = fs.createReadStream(uploadedFile.filePath);

          // Upload the file to S3
          let configuration = { region: process.env.AWS_REGION };
          // @ts-ignore
          const client = new S3Client(configuration);
          const uploadCommand = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: uploadedFile.filename,
            Body: readStream,
          } as any);

          // @ts-ignore
          const awsResponse = await client.send(uploadCommand as any);
          let fileResponse: any = {};
          if (assistant?.modelProviderId === 'openai') {
            let openai = getOpenAI(assistant);
            fileResponse = await openai.files.create({
              file: fs.createReadStream(uploadedFile.filePath),
              purpose: 'assistants',
            });

            // @ts-ignore
            let vectorStoreFileResponse =
              await openai.beta.vectorStores.files.create(folder.object.id, {
                file_id: fileResponse.id,
              });
          }

          // Save file details to the database
          file = await prisma.file.create({
            data: {
              id: fileId,
              name: uploadedFile.filename,
              originalFileName: uploadedFile.originalFileName,
              object: fileResponse,
              folderId: folder.id,
              assistantId: assistant?.id,
            },
          });

          // Clean up after the upload is handled
          fs.unlink(uploadedFile.filePath, (err) => {
            if (err) console.error('Error cleaning up temporary file:', err);
          });
          return resolve(Response.json(file, { status: 201 }));
        } catch (err: any) {
          console.log(err);
          return resolve(
            Response.json({ message: err.message }, { status: 500 })
          );
        }
      } else {
        return resolve(
          Response.json({ message: 'No file uploaded' }, { status: 400 })
        );
      }
    });
  });
}
// Handle GET request to fetch files
export async function GET(req: NextRequest, res: NextResponse) {
  // Get the user session
  const session = await getSession();
  // Extract assistant ID from the request
  let assistantId = getId(req);
  // Fetch assistant details from the database
  let assistant = await getAssistant(assistantId);
  if (!assistant) {
    // If the assistant does not exist, return a 404 response
    return Response.json(
      { message: 'Assistant does not exist' },
      { status: 404 }
    );
  }

  // Validate the incoming token to ensure the user is authorized
  if (!(await validateIncomingToken(session?.user, assistant))) {
    // If the user is not authorized, return a 401 response
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Get the requested folder from the request headers
  let requestedFolder = getRequestedFolder(req);

  let folder: any = null;
  // Find the folder in the assistant's folders
  assistant.Folder.map((item: any) => {
    if (item.name === requestedFolder) {
      folder = item;
    }
  });

  if (!folder) {
    // If the folder does not exist, return a 404 response
    return Response.json({ message: 'Folder does not exist' }, { status: 404 });
  }

  // Fetch files from the database that belong to the requested folder
  let files = await prisma.file.findMany({
    where: {
      folderId: folder.id,
    },
  });

  let updates = false;
  if (assistant?.modelProviderId === 'openai') {
    // Iterate over the files to check their status
    files.map(async (file) => {
      // @ts-ignore
      if (!['completed', 'cancelled', 'failed'].includes(file.object.status)) {
        updates = true;
        let openai = getOpenAI(assistant);

        // Retrieve the file status from OpenAI's vector store
        let vectorStoreFileResponse =
          // @ts-ignore
          await openai.beta.vectorStores.files.retrieve(
            // @ts-ignore
            folder.object.id,
            // @ts-ignore
            file.object.id
          );

        // @ts-ignore
        file.object.status = vectorStoreFileResponse.status;
        // @ts-ignore
        file.object.last_error = vectorStoreFileResponse.last_error;

        // Update the file status in the database
        await prisma.file.update({
          where: {
            id: file.id,
          },
          data: {
            // @ts-ignore
            object: file.object,
          },
        });
      }
    });
  }

  if (updates) {
    // If there were updates, fetch the updated files from the database
    files = await prisma.file.findMany({
      where: {
        folderId: folder.id,
      },
    });
  }

  return Response.json(files, { status: 200 });
}
