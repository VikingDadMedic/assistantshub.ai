import { Badge, Navbar, NavbarBrand, NavbarToggle } from 'flowbite-react';
import Image from 'next/image';
import { UserProfile } from '@/components/UserProfile';

export function Header() {
  return (
    <Navbar fluid rounded className={'border-b border-gray-200'}>
      <NavbarBrand href='https://www.roxie.ai'>
        <Image
          src='/logo.png'
          alt='Roxie Hub Logo'
          width={0}
          height={0}
          sizes='10vw'
          style={{ width: '10%', height: 'auto' }} // optional
        />
        <span className='self-center whitespace-nowrap pl-2 pr-2 text-2xl font-semibold dark:text-white'>
          Roxie Hub
        </span>
        <Badge color='pink'>BETA</Badge>
      </NavbarBrand>
      <UserProfile />
    </Navbar>
  );
}
