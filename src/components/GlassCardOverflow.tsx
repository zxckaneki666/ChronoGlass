import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverEffect?: boolean;
}

export const GlassCardOverflow: React.FC<GlassCardProps> = ({
                                                                children,
                                                                className = '',
                                                                onClick,
                                                                hoverEffect = false
                                                            }) => {
    return (
        <div
            onClick={onClick}
            className={`
        relative overflow-hidden
        bg-glass-100 backdrop-blur-2xl 
        border border-glass-border 
        rounded-3xl shadow-xl
        transition-all duration-300 ease-out
        flex flex-col
        ${hoverEffect ? 'hover:bg-glass-200 hover:scale-[1.01] hover:shadow-2xl cursor-pointer' : ''}
        ${className}
      `}
        >
            {/* Glossy reflection effect */}
            <div
                className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none"/>

            {/*
         CRITICAL FIX:
         The inner container must be flex-col and h-full to allow children (like lists)
         to use flex-1 and scroll properly within the card's boundaries.
      */}
            <div className="relative z-10 h-full w-full flex flex-col overflow-auto">
                {children}
            </div>
        </div>
    );
};
