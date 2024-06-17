import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const useUser = () => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // If user is logged in then user will be a firebase user object
    // else it will be null, meaning user is not logged in
    useEffect(() => {
        const unsubscribe = onAuthStateChanged( getAuth(), user => {
            setUser(user);
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    return { user, isLoading };
}

export default useUser;