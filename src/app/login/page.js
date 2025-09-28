'use client';

import { useState } from 'react';
import './page.css';

export default function LoginPage() {
    const [loginData, setLoginData] = useState({
        email: '',
        password: ''
    });

    const [signupData, setSignupData] = useState({
        fullName: '',
        email: '',
        password: ''
    });

    const [animationState, setAnimationState] = useState('');
    const [cardStates, setCardStates] = useState({
        loginCard: { position: 'below', turned: true },
        signupCard: { position: 'above', turned: false }
    });

    const handleCardFlip = () => {
        setAnimationState('animation-state-1');

        setTimeout(() => {
            // Switch the card positions (this is the key part that was missing)
            setCardStates(prev => ({
                loginCard: {
                    position: prev.loginCard.position === 'below' ? 'above' : 'below',
                    turned: prev.loginCard.turned
                },
                signupCard: {
                    position: prev.signupCard.position === 'above' ? 'below' : 'above',
                    turned: prev.signupCard.turned
                }
            }));

            setTimeout(() => {
                setAnimationState('animation-state-finish');

                setTimeout(() => {
                    // Switch the turned states
                    setCardStates(prev => ({
                        loginCard: { ...prev.loginCard, turned: !prev.loginCard.turned },
                        signupCard: { ...prev.signupCard, turned: !prev.signupCard.turned }
                    }));
                    setAnimationState('');
                }, 300);
            }, 10);
        }, 300);
    };

    const handleLoginChange = (e) => {
        setLoginData({
            ...loginData,
            [e.target.name]: e.target.value
        });
    };

    const handleSignupChange = (e) => {
        setSignupData({
            ...signupData,
            [e.target.name]: e.target.value
        });
    };

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        console.log('Login data:', loginData);
        // Add your login logic here
    };

    const handleSignupSubmit = (e) => {
        e.preventDefault();
        console.log('Signup data:', signupData);
        // Add your signup logic here
    };

    return (
        <div className="login-container">
            {/* Background Video */}
            <video
                className="background-video"
                autoPlay
                loop
                muted
                playsInline
            >
                <source src="/13192-246454317_small.mp4" type="video/mp4" />

                Your browser does not support the video tag.
            </video>

            {/* Optional overlay for better text readability */}
            <div className="video-overlay"></div>

            <div className={`form-collection ${animationState}`}>
                <div className={`card elevation-3 limit-width log-in-card ${cardStates.loginCard.position} ${cardStates.loginCard.turned ? 'turned' : ''}`}>
                    <form onSubmit={handleLoginSubmit}>
                        <div className="card-body">
                            <div className="input-group email">
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Email"
                                    value={loginData.email}
                                    onChange={handleLoginChange}
                                    required
                                />
                            </div>
                            <div className="input-group password">
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Password"
                                    value={loginData.password}
                                    onChange={handleLoginChange}
                                    required
                                />
                            </div>
                            <a href="#" className="box-btn">Forgot Password?</a>
                        </div>
                        <div className="card-footer">
                            <button type="button" className="login-btn" onClick={handleCardFlip}>
                                Log in
                            </button>
                        </div>
                    </form>
                </div>

                <div className={`card elevation-2 limit-width sign-up-card ${cardStates.signupCard.position} ${cardStates.signupCard.turned ? 'turned' : ''}`}>
                    <form onSubmit={handleSignupSubmit}>
                        <div className="card-body">
                            <div className="input-group fullname">
                                <input
                                    type="text"
                                    name="fullName"
                                    placeholder="Full Name"
                                    value={signupData.fullName}
                                    onChange={handleSignupChange}
                                    required
                                />
                            </div>
                            <div className="input-group email">
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Email"
                                    value={signupData.email}
                                    onChange={handleSignupChange}
                                    required
                                />
                            </div>
                            <div className="input-group password">
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Password"
                                    value={signupData.password}
                                    onChange={handleSignupChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="card-footer">
                            <button type="button" className="signup-btn" onClick={handleCardFlip}>
                                Sign Up
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}