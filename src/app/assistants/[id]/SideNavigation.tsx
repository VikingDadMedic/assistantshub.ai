'use client';

import { Avatar, Badge, Button, Card, Sidebar } from 'flowbite-react';
import {
  HiColorSwatch,
  HiChatAlt2,
  HiFolder,
  HiCog,
  HiChartBar,
  HiPuzzle,
} from 'react-icons/hi';
import { Assistant } from '@/app/types/assistant';
import Image from 'next/image';
import { getImageHash } from '@/app/utils/hash';
import React, { useContext } from 'react';
import AssistantContext from '@/app/assistants/[id]/AssistantContext';

export default function SideNavigation() {
  const { assistant } = useContext(AssistantContext);

  const getAssistantComponentUrl = (
    assistant: Assistant,
    component: string
  ) => {
    if (!assistant) return '';
    return `/assistants/${assistant.id}/${component}`;
  };

  return (
    <div className='flex flex-wrap'>
      <div id='logo-sidebar' className='flex flex-auto' aria-label='Sidebar'>
        <Sidebar
          aria-label='Sidebar'
          className='z-40 flex flex-auto items-center justify-center bg-gray-50'
        >
          <Sidebar.Items className='w-54 bg-gray-50'>
            <Sidebar.ItemGroup>
              <Card
                key={assistant.id}
                imgSrc={
                  assistant.profile
                    ? assistant.profile
                    : '/images/people/' + getImageHash(assistant.id) + '.jpg'
                }
                className={'bg-gray-50'}
              >
                <div className='flex flex-col items-center'>
                  <h5 className='mb-1 text-xl font-medium text-gray-900 dark:text-white'>
                    {assistant.name}
                  </h5>
                  <span className='text-sm text-gray-500 dark:text-gray-400'>
                    <div className='flex self-center'>
                      <Badge color='info'>{assistant.modelId}</Badge>
                    </div>
                  </span>
                  <span className='pt-4 text-xs text-gray-500 dark:text-gray-400'>
                    {assistant.description}
                  </span>
                </div>
              </Card>
            </Sidebar.ItemGroup>
            <Sidebar.ItemGroup>
              <Sidebar.Item
                href={getAssistantComponentUrl(assistant, 'analytics')}
                icon={HiChartBar}
              >
                Analytics
              </Sidebar.Item>
              <Sidebar.Item
                href={getAssistantComponentUrl(assistant, 'conversations')}
                icon={HiChatAlt2}
              >
                Conversations
              </Sidebar.Item>
              <Sidebar.Item
                href={getAssistantComponentUrl(assistant, 'documents')}
                icon={HiFolder}
              >
                Documents
              </Sidebar.Item>
              <Sidebar.Item
                href={getAssistantComponentUrl(assistant, 'customize')}
                icon={HiColorSwatch}
              >
                Customize
              </Sidebar.Item>
              <Sidebar.Item
                href={getAssistantComponentUrl(assistant, 'integrate')}
                icon={HiPuzzle}
              >
                Integrate
              </Sidebar.Item>
              <Sidebar.Item
                href={getAssistantComponentUrl(assistant, 'settings')}
                icon={HiCog}
              >
                Settings
              </Sidebar.Item>
            </Sidebar.ItemGroup>
          </Sidebar.Items>
        </Sidebar>
      </div>
    </div>
  );
}
