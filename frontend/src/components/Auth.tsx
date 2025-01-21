const Auth = () => {
  const startAuth = async () => {
    window.location.href = `${import.meta.env.VITE_API_URI!}/initiate-auth`;
  };

  const getUserData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URI!}/user`, {
        credentials: "include",
      });

      const json = await response.json();

      console.log("Response was", json.message);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <h2>Auth</h2>

      <button onClick={startAuth}>Start Auth</button>

      <button onClick={getUserData}>Get my data</button>
    </div>
  );
};

export default Auth;
