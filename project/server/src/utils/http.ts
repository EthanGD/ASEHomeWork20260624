import { Response } from "express";
import { SessionUser } from "../auth.js";

export const sanitizeUser = (user: SessionUser, token: string) => ({
  token,
  user
});

export const sendError = (response: Response, status: number, message: string) => {
  response.status(status).json({ message });
};
