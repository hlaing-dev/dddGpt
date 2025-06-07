import { useEffect, useRef, useState } from "react";
import { decryptImage } from "@/utils/imageDecrypt";
import covergradient from "@/assets/profile/cover-gradient.png";
import "../explore.css";

type ImageWithPlaceholderProps = {
  src: string;
  alt: string;
  className: string;
  needGradient?: boolean;
};

const ImageWithPlaceholder = ({
  src,
  alt,
  className,
  needGradient,
  ...props
}: ImageWithPlaceholderProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [decryptedSrc, setDecryptedSrc] = useState<string>("");
  const [width, setWidth] = useState<any>(0);
  const [height, setHeight] = useState<any>(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            try {
              const decryptedUrl = await decryptImage(src);
              if (imgRef.current) {
                imgRef.current.onload = () => {
                  URL.revokeObjectURL(decryptedUrl); // revoke after image is loaded
                };
              }
              setDecryptedSrc(decryptedUrl);
            } catch (error) {
              console.error("Error decrypting image:", error);
            }
            observer.disconnect();
          }
        }
      },
      {
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [src]);

  const calculateHeight = (width: number, height: number) => {
    if (width > height) {
      return 112; // Portrait
    }
    if (width < height) {
      return 240; // Landscape
    }
    return 200;
  };

  useEffect(() => {
    if (decryptedSrc) {
      const img = new Image();
      img.onload = function () {
        setWidth(img.width);
        setHeight(img.height);
        // Compare width and height of the decrypted image
      };
      img.src = decryptedSrc;
    }
  }, [decryptedSrc]);

  return (
    <div
      ref={containerRef}
      className={`image-container_exp bg-black relative ${className}`}
      style={{ width, height: height && calculateHeight(width, height) }}
    >
      <img
        ref={imgRef}
        src={decryptedSrc || ""}
        alt={alt}
        className={`${className} image-placeholder`}
        {...props}
        style={{
          opacity: decryptedSrc ? "1" : "0",
          transition: "opacity 0.3s",
        }}
      />
      {needGradient && (
        <img
          className={`h-[170px] w-full  absolute bottom-0`}
          src={covergradient}
          alt=""
        />
      )}
    </div>
  );
};

export default ImageWithPlaceholder;
