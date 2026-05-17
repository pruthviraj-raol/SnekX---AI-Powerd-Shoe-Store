/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { normalizeAddress } from "@/lib/shop";
import type { Address } from "@/types/shop";

type AddressPayload = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type AddressContextValue = {
  addresses: Address[];
  isLoading: boolean;
  refreshAddresses: () => Promise<Address[]>;
  addAddress: (payload: AddressPayload) => Promise<Address>;
  updateAddress: (addressId: string, payload: Partial<AddressPayload>) => Promise<Address>;
  deleteAddress: (addressId: string) => Promise<void>;
};

const AddressContext = createContext<AddressContextValue | undefined>(undefined);

export const AddressProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshAddresses = async () => {
    if (!token) {
      setAddresses([]);
      return [];
    }

    setIsLoading(true);

    try {
      const response = await apiRequest<{ success: boolean; addresses: Address[] }>("/api/address", {
        method: "GET",
        token,
      });

      const nextAddresses = response.addresses.map(normalizeAddress);
      setAddresses(nextAddresses);
      return nextAddresses;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !token) {
      setAddresses([]);
      setIsLoading(false);
      return;
    }

    refreshAddresses().catch(() => {
      setAddresses([]);
    });
  }, [authLoading, isAuthenticated, token]);

  const addAddress = async (payload: AddressPayload) => {
    if (!token) {
      throw new Error("Please sign in to save an address.");
    }

    const response = await apiRequest<{ success: boolean; address: Address }>("/api/address/add", {
      method: "POST",
      body: payload,
      token,
    });

    const nextAddress = normalizeAddress(response.address);
    setAddresses((previous) => [nextAddress, ...previous]);
    return nextAddress;
  };

  const updateAddress = async (addressId: string, payload: Partial<AddressPayload>) => {
    if (!token) {
      throw new Error("Please sign in to update an address.");
    }

    const response = await apiRequest<{ success: boolean; address: Address }>("/api/address/update", {
      method: "PUT",
      body: { addressId, ...payload },
      token,
    });

    const nextAddress = normalizeAddress(response.address);
    setAddresses((previous) => previous.map((address) => (address.id === addressId ? nextAddress : address)));
    return nextAddress;
  };

  const deleteAddress = async (addressId: string) => {
    if (!token) {
      throw new Error("Please sign in to delete an address.");
    }

    await apiRequest<{ success: boolean; message: string }>("/api/address/delete", {
      method: "DELETE",
      body: { addressId },
      token,
    });

    setAddresses((previous) => previous.filter((address) => address.id !== addressId));
  };

  return (
    <AddressContext.Provider
      value={{
        addresses,
        isLoading,
        refreshAddresses,
        addAddress,
        updateAddress,
        deleteAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
};

export const useAddresses = () => {
  const context = useContext(AddressContext);

  if (!context) {
    throw new Error("useAddresses must be used within an AddressProvider");
  }

  return context;
};
