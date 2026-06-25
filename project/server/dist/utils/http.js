export const sanitizeUser = (user, token) => ({
    token,
    user
});
export const sendError = (response, status, message) => {
    response.status(status).json({ message });
};
