import {useEffect, useState} from "react";
import axios from 'axios';
import {BASE_URL} from '../config/api.js'

const Header = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userName, setUserName] = useState(null);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleGoogleLogin = async () => {
        try {
            window.location.href = `${BASE_URL}/api/auth/google`;
        } catch (error) {
            console.error('Google login failed', error);
        }
    };

    const handleGithubLogin = async () => {
        try {
            window.location.href = `${BASE_URL}/api/auth/github`;
        } catch (error) {
            console.error('Github login failed', error);
        }
    };

    const fetchUserData = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/auth/user-info`, {credentials: 'include'});
            if (response.ok) {
                const data = await response.json();
                setUserName(data.userName);
            } else {
                setUserName(null);
            }
        } catch (err) {
            console.log(err)
        } finally {
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    const handleLogout = async () => {
        await axios.get(`${BASE_URL}/api/auth/logout`, {withCredentials: true})
            .then(res => {
                console.log('response ', res);
                setUserName(res.data.user);
            })
            .catch(e=> console.log(e))
    };

    return (
        <header className="flex justify-between items-center px-10 py-4 text-white">
            <div className="text-4xl font-bold">NCD Calculator</div>
            {!userName ? (
                <button
                    className="text-white bg-blue-500 px-4 py-2 rounded-lg focus:outline-none"
                    onClick={openModal}>
                    Login
                </button>
            ) : (
                <div className="flex items-center space-x-4">
                    <span className="text-white">{userName}</span>
                    <button
                        className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600"
                        onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            )}

            {isModalOpen && (
                <div
                    className="fixed z-50 inset-0 flex justify-center items-center bg-black bg-opacity-50 backdrop-blur-sm"
                    onClick={closeModal}>
                    <div
                        className="bg-white p-6 rounded-lg w-80" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-center text-xl font-semibold mb-4 text-black">Choose Login Options:</h2>
                        <div className="flex flex-col items-center space-y-4">
                            <button
                                className="bg-red-500 text-white px-6 py-2 rounded-full w-full"
                                onClick={handleGoogleLogin}>
                                Login with Google
                            </button>
                            <button
                                className="bg-green-700 text-white px-6 py-2 rounded-full w-full"
                                onClick={handleGithubLogin}>
                                Login with Github
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;