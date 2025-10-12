'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './page.css';

const time_to_show_login = 400;
const time_to_hidden_login = 200;
const time_to_show_sign_up = 100;
const time_to_hidden_sign_up = 400;
const time_to_hidden_all = 500;

// Replace with your Google Client ID
const GOOGLE_CLIENT_ID = '423273358250-5sh66sd211creanihac75uaith2vhh1e.apps.googleusercontent.com';

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
    const [turnstileToken, setTurnstileToken] = useState(null);
    const videoRef = useRef(null);
    const fullPageVideoRef = useRef(null);
    const turnstileRef = useRef(null);

    useEffect(() => {
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

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const changeToLogin = () => {
        setActiveForm('login');
        setLoginDisplay('block');
        setSignUpOpacity(0);
        setError(null);
        setTimeout(() => {
            setLoginOpacity(1);
            if (turnstileRef.current && window.turnstile) {
                window.turnstile.render(turnstileRef.current, {
                    sitekey: '0x4AAAAAAB4cfsr9SqqyyKm3',
                    callback: (token) => {
                        setTurnstileToken(token);
                    },
                });
            }
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
            if (turnstileRef.current && window.turnstile) {
                window.turnstile.render(turnstileRef.current, {
                    sitekey: '0x4AAAAAAB4cfsr9SqqyyKm3',
                    callback: (token) => {
                        setTurnstileToken(token);
                    },
                });
            }
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
        setTurnstileToken(null);
        setTimeout(() => {
            setLoginDisplay('none');
            setSignUpDisplay('none');
            if (window.turnstile && turnstileRef.current) {
                window.turnstile.reset(turnstileRef.current);
            }
        }, time_to_hidden_all);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!turnstileToken) {
            setError('Please complete the CAPTCHA verification');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post('https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net/api/login', {
                username: loginEmail,
                password: loginPassword,
                turnstileToken,
            });
            const user = response.data.user;
            window.localStorage.setItem('user', JSON.stringify(user));
            setLoading(false);
            router.push('/youtube');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Login failed');
            if (window.turnstile && turnstileRef.current) {
                window.turnstile.reset(turnstileRef.current);
            }
            setTurnstileToken(null);
        }
    };

    const handleGoogleLoginSuccess = async (credentialResponse) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post('https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net/api/google-login', {
                googleToken: credentialResponse.credential,
            });
            const user = response.data.user;
            window.localStorage.setItem('user', JSON.stringify(user));
            setLoading(false);
            router.push('/youtube');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Google login failed');
        }
    };

    const handleGoogleLoginFailure = () => {
        setError('Google login failed. Please try again.');
        setLoading(false);
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

        if (!turnstileToken) {
            setError('Please complete the CAPTCHA verification');
            setLoading(false);
            return;
        }

        try {
            // Perform signup
            const signupResponse = await axios.post('https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net/api/signup', {
                username: signupUsername,
                email: signupEmail,
                password: signupPassword,
            });
            const user = signupResponse.data.user;

            // Automatically log in after successful signup
            const loginResponse = await axios.post('https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net/api/login', {
                username: signupUsername,
                password: signupPassword,
                turnstileToken,
            });

            // Store user data and redirect to dashboard
            window.localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
            setLoading(false);
            router.push('/youtube');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Signup or login failed');
            if (window.turnstile && turnstileRef.current) {
                window.turnstile.reset(turnstileRef.current);
            }
            setTurnstileToken(null);
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
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
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
                                <div className="google-login">
                                    <GoogleLogin
                                        onSuccess={handleGoogleLoginSuccess}
                                        onError={handleGoogleLoginFailure}
                                        useOneTap
                                        theme="filled_black"
                                        size="large"
                                        shape="rectangular"
                                        text="signin_with"
                                        render={(renderProps) => (
                                            <button
                                                className="btn_login google-btn"
                                                onClick={renderProps.onClick}
                                                disabled={renderProps.disabled}
                                            >
                                                Sign in with Google
                                            </button>
                                        )}
                                    />
                                </div>
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
                                <div
                                    ref={turnstileRef}
                                    className="cf-turnstile"
                                    data-sitekey="0x4AAAAAAB4cfsr9SqqyyKm3"
                                    data-callback="onTurnstileSuccess"
                                ></div>
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
                                <div
                                    ref={turnstileRef}
                                    className="cf-turnstile"
                                    data-sitekey="0x4AAAAAAB4cfsr9SqqyyKm3"
                                    data-callback="onTurnstileSuccess"
                                ></div>
                                <button className="btn_sign_up" onClick={handleSignup}>
                                    SIGN UP
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
}