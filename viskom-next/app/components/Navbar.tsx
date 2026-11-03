'use client';

import { useState } from "react";


export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    return (
        <nav className="bg-[#0B1354] fixed w-full z-20 top-0 start-0 border-b border-[#0B1354]">
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">

                <a href="#hero" className="flex items-center space-x-3 rtl:space-x-reverse">
                    <span className="self-center text-xl font-bold whitespace-nowrap text-white">Rakku</span>
                </a>

                <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse items-center">
                    <a href="#demo" className="text-[#0B1354] bg-[#F5D010] hover:bg-yellow-400 font-bold rounded-lg text-sm px-5 py-2.5 text-center transition-colors">
                        Mulai Deteksi
                    </a>

                    {/* Button Hamburger Menu */}
                    <button
                        onClick={toggleMenu}
                        type="button"
                        className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-white rounded-lg md:hidden hover:bg-[#131e73] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        aria-controls="navbar-default"
                        aria-expanded={isOpen}
                    >
                        <span className="sr-only">Open main menu</span>
                        {isOpen ? (
                            /* Icon Close (X) */
                            <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            /* Icon Hamburger */
                            <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M5 7h14M5 12h14M5 17h14" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Navigasi Link Mobile & Desktop */}
                <div
                    className={`${isOpen ? "block" : "hidden"
                        } items-center justify-between w-full md:flex md:w-auto md:order-1`}
                    id="navbar-default"
                >
                    <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 border border-[#131e73] rounded-lg bg-[#0B1354] md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0">
                        <li>
                            <a
                                href="#cara-kerja"
                                onClick={() => setIsOpen(false)}
                                className="block py-2 px-3 text-white rounded hover:text-[#F5D010] md:p-0 transition-colors"
                            >
                                Cara Kerja
                            </a>
                        </li>
                        <li>
                            <a
                                href="#demo"
                                onClick={() => setIsOpen(false)}
                                className="block py-2 px-3 text-white rounded hover:text-[#F5D010] md:p-0 transition-colors"
                            >
                                Demo Interaktif
                            </a>
                        </li>
                        <li>
                            <a
                                href="#about"
                                onClick={() => setIsOpen(false)}
                                className="block py-2 px-3 text-white rounded hover:text-[#F5D010] md:p-0 transition-colors"
                            >
                                Tentang
                            </a>
                        </li>
                    </ul>
                </div>

            </div>
        </nav>
    );
}