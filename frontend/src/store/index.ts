import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import appointmentsReducer from "./slices/appointmentsSlice";
import patientsReducer from "./slices/patientsSlice";
import doctorsReducer from "./slices/doctorsSlice";
import labReducer from "./slices/labSlice";
import billingReducer from "./slices/billingSlice";
import uiReducer from "./slices/uiSlice";
import tenantReducer from "./slices/tenantSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    appointments: appointmentsReducer,
    patients: patientsReducer,
    doctors: doctorsReducer,
    lab: labReducer,
    billing: billingReducer,
    ui: uiReducer,
    tenant: tenantReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
