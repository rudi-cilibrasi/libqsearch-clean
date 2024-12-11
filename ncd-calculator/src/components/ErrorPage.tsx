import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import oopsImage from '../assets/oops.jpg';

type ErrorPageProps = {};

const ErrorPage: FC<ErrorPageProps> = (): JSX.Element => {
    const navigate = useNavigate();

    const handleGoBack = (): void => {
        navigate('/');
    };

    return (
        <div className="flex justify-center items-center w-full h-screen">
            <div
                className="flex flex-col justify-center items-center text-center bg-white p-10 rounded-lg shadow-lg w-[80vw] h-[60vh]">
                <img
                    src={oopsImage}
                    alt="Error Icon"
                    className="w-[20vw] h-[25vh]"
                />

                <h1 className="text-6xl text-red-600 font-bold">Oops!</h1>
                <p className="mt-4 text-lg text-gray-700">Something went wrong. Please try again later.</p>
                <button
                    onClick={handleGoBack}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Back to Home page
                </button>
            </div>
        </div>
    );
};

export default ErrorPage;