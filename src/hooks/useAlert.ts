'use client';

import { useState, useCallback } from 'react';

interface AlertConfig {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  cancelText?: string;
  showCancel?: boolean;
}

export function useAlert() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = useCallback((alertConfig: AlertConfig) => {
    setConfig(alertConfig);
    setIsOpen(true);
  }, []);

  const hideAlert = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Convenience methods
  const showSuccess = useCallback((message: string, title: string = 'Success') => {
    showAlert({ title, message, type: 'success' });
  }, [showAlert]);

  const showError = useCallback((message: string, title: string = 'Error') => {
    showAlert({ title, message, type: 'error' });
  }, [showAlert]);

  const showWarning = useCallback((message: string, title: string = 'Warning') => {
    showAlert({ title, message, type: 'warning' });
  }, [showAlert]);

  const showInfo = useCallback((message: string, title: string = 'Information') => {
    showAlert({ title, message, type: 'info' });
  }, [showAlert]);

  const showConfirm = useCallback((
    message: string,
    onConfirm: () => void,
    title: string = 'Confirm',
    type: 'warning' | 'info' = 'warning',
    onCancel?: () => void
  ) => {
    showAlert({
      title,
      message,
      type,
      onConfirm,
      onCancel,
      showCancel: true,
      confirmText: 'Confirm',
      cancelText: 'Cancel'
    });
  }, [showAlert]);

  return {
    isOpen,
    config,
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm
  };
}
