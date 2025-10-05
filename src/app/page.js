'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Music, Play, Users, Search, List, Shield, TrendingUp, Heart, Headphones, Radio, Mic2, Library, ChevronLeft, ChevronRight, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube, Sparkles } from 'lucide-react';

export default function MusicLandingPage() {
    const [activeSlide, setActiveSlide] = useState(0);
    const [isVisible, setIsVisible] = useState({});
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [scrollY, setScrollY] = useState(0);
    const [particles, setParticles] = useState([]);
    const heroRef = useRef(null);

    // Add chatbot scripts
    useEffect(() => {
        // Create the configuration script
        const configScript = document.createElement('script');
        configScript.innerHTML = `window.chtlConfig = { chatbotId: "8783531273" };`;
        document.head.appendChild(configScript);

        // Create the embed script
        const embedScript = document.createElement('script');
        embedScript.async = true;
        embedScript.setAttribute('data-id', '8783531273');
        embedScript.id = 'chtl-script';
        embedScript.type = 'text/javascript';
        embedScript.src = 'https://chatling.ai/js/embed.js';
        document.head.appendChild(embedScript);

        // Cleanup scripts on component unmount
        return () => {
            document.head.removeChild(configScript);
            document.head.removeChild(embedScript);
        };
    }, []);

    useEffect(() => {
        const newParticles = [...Array(50)].map(() => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 1}px`,
            height: `${Math.random() * 4 + 1}px`,
            background: `rgba(${Math.random() * 255}, ${Math.random() * 255}, 255, 0.5)`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${Math.random() * 10 + 10}s`
        }));
        setParticles(newParticles);
    }, []);

    const carouselItems = [
        {
            image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=600&fit=crop",
            title: "Discover Your Sound",
            subtitle: "Stream millions of songs anytime, anywhere"
        },
        {
            image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=600&fit=crop",
            title: "Create Your Vibe",
            subtitle: "Build personalized playlists for every moment"
        },
        {
            image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1200&h=600&fit=crop",
            title: "Experience Music Like Never Before",
            subtitle: "High-quality streaming with intelligent recommendations"
        }
    ];

    const features = [
        {
            icon: <Play />,
            title: "On-Demand Streaming",
            description: "Stream your favorite songs instantly with high-quality audio playback",
            color: "from-purple-500 to-pink-500"
        },
        {
            icon: <List />,
            title: "Playlist Management",
            description: "Create, organize, and share custom playlists for every mood",
            color: "from-blue-500 to-cyan-500"
        },
        {
            icon: <Search />,
            title: "Smart Search",
            description: "Find songs, artists, and albums with advanced filtering options",
            color: "from-green-500 to-emerald-500"
        },
        {
            icon: <TrendingUp />,
            title: "Music Recommendations",
            description: "Discover new music based on your listening preferences and history",
            color: "from-orange-500 to-red-500"
        },
        {
            icon: <Users />,
            title: "User Authentication",
            description: "Secure login system with personalized user profiles",
            color: "from-indigo-500 to-purple-500"
        },
        {
            icon: <Shield />,
            title: "Admin Panel",
            description: "Complete management system for songs, artists, and user activities",
            color: "from-pink-500 to-rose-500"
        },
        {
            icon: <Heart />,
            title: "Favorites & Likes",
            description: "Save your favorite tracks and build your personal music library",
            color: "from-red-500 to-pink-500"
        },
        {
            icon: <Radio />,
            title: "Responsive Design",
            description: "Seamless experience across all devices - desktop, tablet, and mobile",
            color: "from-cyan-500 to-blue-500"
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % carouselItems.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('scroll', handleScroll);

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setIsVisible((prev) => ({
                        ...prev,
                        [entry.target.id]: entry.isIntersecting
                    }));
                });
            },
            { threshold: 0.1 }
        );

        document.querySelectorAll('.animate-on-scroll').forEach((el) => {
            observer.observe(el);
        });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, []);

    const nextSlide = () => setActiveSlide((prev) => (prev + 1) % carouselItems.length);
    const prevSlide = () => setActiveSlide((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-indigo-900/20 to-blue-900/20" />
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.15), transparent 50%)`
                    }}
                />
                {particles.map((particle, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-float"
                        style={particle}
                    />
                ))}
            </div>

            <nav className="fixed top-0 w-full bg-black/40 backdrop-blur-2xl z-50 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center space-x-3 group cursor-pointer">
                            <div className="relative">
                                <Music className="w-10 h-10 text-purple-400 animate-pulse-slow" />
                                <div className="absolute inset-0 bg-purple-400 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>
                            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient bg-300">
                                MusicStream
                            </span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <a href="#about" className="relative px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-full font-semibold overflow-hidden group">
                                <span className="relative z-10">About</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-green-400 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                            </a>
                            <a href="#features" className="relative px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full font-semibold overflow-hidden group">
                                <span className="relative z-10">Features</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-blue-400 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                            </a>
                            <a href="/dashboard" className="relative px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full font-semibold overflow-hidden group">
                                <span className="relative z-10">Login</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-purple-400 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                            </a>
                        </div>
                    </div>
                </div>
            </nav>

            <div ref={heroRef} className="relative h-screen mt-20 overflow-hidden">
                {carouselItems.map((item, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-1000 ${
                            index === activeSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110'
                        }`}
                    >
                        <div
                            className="absolute inset-0 bg-cover bg-center transform transition-transform duration-[20000ms]"
                            style={{
                                backgroundImage: `url(${item.image})`,
                                transform: index === activeSlide ? 'scale(1.1)' : 'scale(1)'
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
                        </div>
                        <div className="relative h-full flex items-center">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                                <div className="max-w-3xl">
                                    <div className="mb-6 flex items-center space-x-2 animate-slide-in-left">
                                        <Sparkles className="w-6 h-6 text-purple-400 animate-spin-slow" />
                                        <span className="text-purple-400 font-semibold tracking-wider uppercase">New Experience</span>
                                    </div>
                                    <h1 className="text-7xl font-black mb-6 animate-slide-in-left animation-delay-200">
                                        <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                                            {item.title}
                                        </span>
                                    </h1>
                                    <p className="text-3xl text-gray-200 mb-10 animate-slide-in-left animation-delay-400 leading-relaxed">
                                        {item.subtitle}
                                    </p>
                                    <div className="flex space-x-4 animate-slide-in-left animation-delay-600">
                                        <button className="group relative px-10 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-full text-xl font-bold overflow-hidden">
                                            <span className="relative z-10 flex items-center space-x-2">
                                                <Play className="w-6 h-6" />
                                                <span>Start Listening</span>
                                            </span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-pink-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-full blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
                                        </button>
                                        <button className="px-10 py-5 border-2 border-white/30 backdrop-blur-sm rounded-full text-xl font-bold hover:bg-white/10 hover:border-white/50 transition-all duration-300">
                                            Learn More
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={prevSlide}
                    className="absolute left-8 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 backdrop-blur-xl border border-white/20 group"
                >
                    <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform duration-300" />
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 backdrop-blur-xl border border-white/20 group"
                >
                    <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform duration-300" />
                </button>

                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex space-x-3">
                    {carouselItems.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveSlide(index)}
                            className={`h-2 rounded-full transition-all duration-500 ${
                                index === activeSlide
                                    ? 'bg-gradient-to-r from-purple-400 to-pink-400 w-16'
                                    : 'bg-white/30 w-8 hover:bg-white/50'
                            }`}
                        />
                    ))}
                </div>
            </div>

            <section id="about" className="animate-on-scroll py-32 relative">
                <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
                    isVisible.about ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
                }`}>
                    <div className="text-center mb-20">
                        <div className="inline-block mb-6 px-6 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full backdrop-blur-sm animate-pulse-slow">
                            <span className="text-purple-300 font-semibold">About Us</span>
                        </div>
                        <h2 className="text-6xl font-black mb-6">
                            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient bg-300">
                                About MusicStream
                            </span>
                        </h2>
                        <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                            The Music Web Application is an interactive platform that allows users to stream, manage, and discover music online.
                            Experience seamless music streaming with personalized playlists, intelligent recommendations, and a user-friendly interface.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: Headphones, title: "High-Quality Audio", desc: "Experience crystal-clear sound with our premium streaming quality", color: "purple" },
                            { icon: Library, title: "Vast Library", desc: "Access millions of songs across all genres and languages", color: "blue" },
                            { icon: Mic2, title: "Artist Support", desc: "Discover and support your favorite artists directly", color: "pink" }
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl p-10 rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-500 hover:scale-105 hover:-translate-y-4"
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br from-${item.color}-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                <div className={`w-20 h-20 bg-gradient-to-br from-${item.color}-500 to-${item.color}-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 relative`}>
                                    <item.icon className="w-10 h-10" />
                                    <div className={`absolute inset-0 bg-${item.color}-400 blur-xl opacity-0 group-hover:opacity-75 transition-opacity duration-500`} />
                                </div>
                                <h3 className="text-3xl font-bold mb-4">{item.title}</h3>
                                <p className="text-gray-300 text-lg leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="features" className="animate-on-scroll py-32 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent" />
                <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative transition-all duration-1000 ${
                    isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
                }`}>
                    <div className="text-center mb-20">
                        <div className="inline-block mb-6 px-6 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full backdrop-blur-sm animate-pulse-slow">
                            <span className="text-blue-300 font-semibold">Features</span>
                        </div>
                        <h2 className="text-6xl font-black mb-6">
                            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient bg-300">
                                Powerful Features
                            </span>
                        </h2>
                        <p className="text-2xl text-gray-300">Everything you need for the perfect music experience</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-500 hover:scale-105 hover:-translate-y-4 cursor-pointer"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 rounded-3xl transition-all duration-500" />
                                <div className={`relative w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                    {React.cloneElement(feature.icon, { className: "w-8 h-8 relative z-10" })}
                                    <div className="absolute inset-0 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3 relative">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed relative">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-900/20 to-black" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <div className="grid md:grid-cols-4 gap-8 text-center">
                        {[
                            { value: "50M+", label: "Songs Available", color: "purple" },
                            { value: "10M+", label: "Active Users", color: "blue" },
                            { value: "100K+", label: "Artists", color: "purple" },
                            { value: "24/7", label: "Support", color: "blue" }
                        ].map((stat, i) => (
                            <div key={i} className="group relative">
                                <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/20 to-transparent rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 group-hover:border-white/30 group-hover:scale-110 transition-all duration-500">
                                    <div className={`text-7xl font-black text-transparent bg-gradient-to-br from-${stat.color}-400 to-${stat.color}-600 bg-clip-text mb-4 group-hover:scale-125 transition-transform duration-500`}>
                                        {stat.value}
                                    </div>
                                    <div className="text-xl text-gray-300 font-semibold">{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="relative bg-black/60 border-t border-white/10 backdrop-blur-2xl py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        <div>
                            <div className="flex items-center space-x-3 mb-6">
                                <Music className="w-10 h-10 text-purple-400" />
                                <span className="text-2xl font-bold">MusicStream</span>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                Your ultimate music streaming platform for discovering, creating, and enjoying music.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-bold text-xl mb-6">Quick Links</h3>
                            <ul className="space-y-3 text-gray-400">
                                <li><a href="#" className="hover:text-purple-400 transition-colors duration-300 hover:translate-x-2 inline-block">About Us</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors duration-300 hover:translate-x-2 inline-block">Features</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors duration-300 hover:translate-x-2 inline-block">Pricing</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors duration-300 hover:translate-x-2 inline-block">FAQ</a></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-xl mb-6">Contact Us</h3>
                            <ul className="space-y-4 text-gray-400">
                                <li className="flex items-center space-x-3 hover:text-purple-400 transition-colors duration-300">
                                    <Mail className="w-5 h-5" />
                                    <span>support@erragada.com</span>
                                </li>
                                <li className="flex items-center space-x-3 hover:text-purple-400 transition-colors duration-300">
                                    <Phone className="w-5 h-5" />
                                    <span>100</span>
                                </li>
                                <li className="flex items-center space-x-3 hover:text-purple-400 transition-colors duration-300">
                                    <MapPin className="w-5 h-5" />
                                    <span>Chanchalguda Jail</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-xl mb-6">Follow Us</h3>
                            <div className="flex space-x-4">
                                {[
                                    { Icon: Facebook, color: "from-blue-600 to-blue-700" },
                                    { Icon: Twitter, color: "from-sky-500 to-blue-600" },
                                    { Icon: Instagram, color: "from-pink-600 to-purple-600" },
                                    { Icon: Youtube, color: "from-red-600 to-red-700" }
                                ].map(({ Icon, color }, i) => (
                                    <a
                                        key={i}
                                        href="#"
                                        className={`relative w-12 h-12 bg-gradient-to-br ${color} rounded-full flex items-center justify-center group overflow-hidden`}
                                    >
                                        <Icon className="w-6 h-6 relative z-10 group-hover:scale-125 transition-transform duration-300" />
                                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-8 text-center text-gray-400">
                        <p>&copy; 2025 MusicStream. All rights reserved. | Privacy Policy | Terms of Service</p>
                    </div>
                </div>
            </footer>

            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }

                @keyframes gradient {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }

                @keyframes slide-in-left {
                    from {
                        opacity: 0;
                        transform: translateX(-50px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }

                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .animate-float {
                    animation: float linear infinite;
                }

                .animate-gradient {
                    animation: gradient 3s ease infinite;
                }

                .animate-slide-in-left {
                    animation: slide-in-left 0.8s ease-out forwards;
                }

                .animate-pulse-slow {
                    animation: pulse-slow 3s ease-in-out infinite;
                }

                .animate-spin-slow {
                    animation: spin-slow 3s linear infinite;
                }

                .bg-300 {
                    background-size: 300%;
                }

                .animation-delay-200 {
                    animation-delay: 0.2s;
                    opacity: 0;
                }

                .animation-delay-400 {
                    animation-delay: 0.4s;
                    opacity: 0;
                }

                .animation-delay-600 {
                    animation-delay: 0.6s;
                    opacity: 0;
                }
            `}</style>
        </div>
    );
}