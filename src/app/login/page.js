'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import './page.css';

const time_to_show_login = 400;
const time_to_hidden_login = 200;
const time_to_show_sign_up = 100;
const time_to_hidden_sign_up = 400;
const time_to_hidden_all = 500;

export default function Home() {
    const router = useRouter();
    const [activeForm, setActiveForm] = useState('none');
    const [loginDisplay, setLoginDisplay] = useState('none');
    const [loginOpacity, setLoginOpacity] = useState(0);
    const [signUpDisplay, setSignUpDisplay] = useState('none');
    const [signUpOpacity, setSignUpOpacity] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupUsername, setSignupUsername] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const fullPageVideoRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = 0.3;
            audioRef.current.play().catch(() => {
                console.log('Audio autoplay prevented');
            });
        }
        if (videoRef.current) {
            videoRef.current.play().catch(() => {
                console.log('Video autoplay prevented (form background)');
            });
        }
        if (fullPageVideoRef.current) {
            fullPageVideoRef.current.play().catch(() => {
                console.log('Video autoplay prevented (full page background)');
            });
        }
    }, []);

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const changeToLogin = () => {
        setActiveForm('login');
        setLoginDisplay('block');
        setSignUpOpacity(0);
        setError(null);
        setTimeout(() => {
            setLoginOpacity(1);
        }, time_to_show_login);
        setTimeout(() => {
            setSignUpDisplay('none');
        }, time_to_hidden_login);
    };

    const changeToSignUp = () => {
        setActiveForm('signup');
        setSignUpDisplay('block');
        setLoginOpacity(0);
        setError(null);
        setTimeout(() => {
            setSignUpOpacity(1);
        }, time_to_show_sign_up);
        setTimeout(() => {
            setLoginDisplay('none');
        }, time_to_hidden_sign_up);
    };

    const hiddenLoginAndSignUp = () => {
        setActiveForm('none');
        setLoginOpacity(0);
        setSignUpOpacity(0);
        setError(null);
        setTimeout(() => {
            setLoginDisplay('none');
            setSignUpDisplay('none');
        }, time_to_hidden_all);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post('http://localhost:5000/api/login', {
                username: loginEmail,
                password: loginPassword
            });
            const user = response.data.user;
            window.localStorage.setItem('user', JSON.stringify(user));
            setLoading(false);
            router.push('/');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Login failed');
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (signupPassword !== signupConfirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post('http://localhost:5000/api/signup', {
                username: signupUsername,
                email: signupEmail,
                password: signupPassword
            });
            const user = response.data.user;
            window.localStorage.setItem('user', JSON.stringify(user));
            setLoading(false);
            router.push('/');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Signup failed');
        }
    };

    let contFormsClass = 'cont_forms';
    if (activeForm === 'login') {
        contFormsClass += ' cont_forms_active_login';
    } else if (activeForm === 'signup') {
        contFormsClass += ' cont_forms_active_sign_up';
    }

    const formBackgroundVideo = '/25001-347024098_small.mp4';
    const fullPageBackgroundVideo = '/25001-347024098_small.mp4';

    return (
        <>
            <video
                ref={fullPageVideoRef}
                className="full-page-video"
                autoPlay
                loop
                muted
                playsInline
            >
                <source src={fullPageBackgroundVideo} type="video/mp4" />
            </video>

            <audio ref={audioRef} loop>
                <source src="https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3" type="audio/mpeg" />
            </audio>

            <button
                onClick={toggleMute}
                className="music-toggle"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>

            <div className="towers-background">
                <div className="tower tower-1"></div>
                <div className="tower tower-2"></div>
                <div className="tower tower-3"></div>
                <div className="tower tower-4"></div>
                <div className="tower tower-5"></div>
            </div>

            <div className="cotn_principal">
                <div className="cont_centrar">
                    <div className="cont_login">
                        <div className="cont_info_log_sign_up">
                            <div className="col_md_login">
                                <div className="cont_ba_opcitiy">
                                    <h2>LOGIN</h2>
                                    <p>Access your account to continue your journey with us.</p>
                                    <button className="btn_login" onClick={changeToLogin}>
                                        LOGIN
                                    </button>
                                </div>
                            </div>
                            <div className="col_md_sign_up">
                                <div className="cont_ba_opcitiy">
                                    <h2>SIGN UP</h2>
                                    <p>Create a new account and join our community today.</p>
                                    <button className="btn_sign_up" onClick={changeToSignUp}>
                                        SIGN UP
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="cont_back_info">
                            <div className="cont_img_back_grey">
                                <video ref={videoRef} autoPlay loop muted playsInline>
                                    <source src={formBackgroundVideo} type="video/mp4" />
                                </video>
                            </div>
                        </div>

                        <div className={contFormsClass}>
                            <div className="cont_img_back_">
                                <video autoPlay loop muted playsInline>
                                    <source src={formBackgroundVideo} type="video/mp4" />
                                </video>
                            </div>

                            <div
                                className="cont_form_login"
                                style={{ display: loginDisplay, opacity: loginOpacity }}
                            >
                                <a href="#" onClick={(e) => { e.preventDefault(); hiddenLoginAndSignUp(); }} className="close-btn">
                                    ✕
                                </a>
                                <h2>LOGIN</h2>
                                {error && <p className="error-text">{error}</p>}
                                {loading && <p>Loading...</p>}
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                />
                                <button className="btn_login" onClick={handleLogin}>
                                    LOGIN
                                </button>
                            </div>

                            <div
                                className="cont_form_sign_up"
                                style={{ display: signUpDisplay, opacity: signUpOpacity }}
                            >
                                <a href="#" onClick={(e) => { e.preventDefault(); hiddenLoginAndSignUp(); }} className="close-btn">
                                    ✕
                                </a>
                                <h2>SIGN UP</h2>
                                {error && <p className="error-text">{error}</p>}
                                {loading && <p>Loading...</p>}
                                <input
                                    type="text"
                                    placeholder="Email"
                                    value={signupEmail}
                                    onChange={(e) => setSignupEmail(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={signupUsername}
                                    onChange={(e) => setSignupUsername(e.target.value)}
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={signupPassword}
                                    onChange={(e) => setSignupPassword(e.target.value)}
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    value={signupConfirmPassword}
                                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                />
                                <button className="btn_sign_up" onClick={handleSignup}>
                                    SIGN UP
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}