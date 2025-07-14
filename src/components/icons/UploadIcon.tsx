import React from "react";

interface IconProps {
    className?: string;
}

export const UploadIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        className={className}
        width='24'
        height='24'
        viewBox='0 0 24 24'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M12 16L12 8M12 8L9 11M12 8L15 11'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M3 15V16C3 17.8856 3 18.8284 3.58579 19.4142C4.17157 20 5.11438 20 7 20H17C18.8856 20 19.8284 20 20.4142 19.4142C21 18.8284 21 17.8856 21 16V15'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);
