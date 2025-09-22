'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImageIcon, X, Upload } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  onImageSelect: (imageUrl: string | null) => void;
  selectedImage?: string | null;
  disabled?: boolean;
}

export function ImageUpload({ onImageSelect, selectedImage, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 检查文件大小（限制为10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('图片文件大小不能超过10MB');
      return;
    }

    setIsUploading(true);

    try {
      // 将图片转换为Base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        onImageSelect(imageUrl);
        setIsUploading(false);
      };
      reader.onerror = () => {
        alert('图片读取失败');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      alert('图片上传失败');
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    if (selectedImage) {
      handleRemoveImage();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      {selectedImage ? (
        <div className="relative flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
          <div className="relative w-12 h-12 rounded overflow-hidden">
            <Image
              src={selectedImage}
              alt="Selected image"
              fill
              className="object-cover"
            />
          </div>
          <span className="text-sm text-gray-600">已选择图片</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemoveImage}
            disabled={disabled}
            className="p-1 h-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          disabled={disabled || isUploading}
          className="flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <Upload className="w-4 h-4 animate-spin" />
              <span>上传中...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              <span>添加图片</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}