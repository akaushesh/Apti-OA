import { createSlice } from '@reduxjs/toolkit';
import storage from './storage';

const initialState = storage.get("auth", {
  status: false,
  userData: null,
  accessToken: null,
  refreshToken: null,
});

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      const payloadUser = action.payload?.user || (action.payload?.username ? action.payload : null);
      const accessToken = action.payload?.accessToken || localStorage.getItem("accessToken");
      const refreshToken = action.payload?.refreshToken || null;

      state.status = true;
      state.userData = payloadUser;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;

      storage.set("auth", {
        status: true,
        userData: payloadUser,
        accessToken,
        refreshToken,
      });
    },

    logout: (state) => {
      state.status = false;
      state.userData = null;
      state.accessToken = null;
      state.refreshToken = null;
      storage.remove('auth');
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;