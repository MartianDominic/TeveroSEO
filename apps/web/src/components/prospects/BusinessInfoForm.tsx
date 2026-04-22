"use client";

/**
 * Manual business information input form.
 * Shown when scraping fails or confidence is too low.
 * Phase 27-03: AI Business Extractor
 */
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
} from "@tevero/ui";
import { Plus, X } from "lucide-react";

interface BusinessInfoFormProps {
  prospectId: string;
  onSubmit: (data: BusinessInfoFormData) => Promise<void>;
}

export interface BusinessInfoFormData {
  products: string[];
  brands: string[];
  services: string[];
  location: string;
  targetMarket: "residential" | "commercial" | "both" | "";
  summary: string;
}

export function BusinessInfoForm({ prospectId, onSubmit }: BusinessInfoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<string[]>([""]);
  const [brands, setBrands] = useState<string[]>([""]);
  const [services, setServices] = useState<string[]>([""]);
  const [location, setLocation] = useState("");
  const [targetMarket, setTargetMarket] = useState<"residential" | "commercial" | "both" | "">("");
  const [summary, setSummary] = useState("");

  const handleAddField = (
    list: string[],
    setter: (list: string[]) => void,
  ) => {
    setter([...list, ""]);
  };

  const handleRemoveField = (
    list: string[],
    setter: (list: string[]) => void,
    index: number,
  ) => {
    setter(list.filter((_, i) => i !== index));
  };

  const handleUpdateField = (
    list: string[],
    setter: (list: string[]) => void,
    index: number,
    value: string,
  ) => {
    const updated = [...list];
    updated[index] = value;
    setter(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        products: products.filter((p) => p.trim() !== ""),
        brands: brands.filter((b) => b.trim() !== ""),
        services: services.filter((s) => s.trim() !== ""),
        location,
        targetMarket,
        summary,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Business Information</CardTitle>
        <CardDescription>
          Enter business information manually to help us better understand this
          prospect.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Products */}
          <div>
            <Label>Products</Label>
            <div className="space-y-2 mt-2">
              {products.map((product, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={product}
                    onChange={(e) =>
                      handleUpdateField(products, setProducts, idx, e.target.value)
                    }
                    placeholder="e.g., AC Units, Solar Panels"
                  />
                  {products.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        handleRemoveField(products, setProducts, idx)
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddField(products, setProducts)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Brands */}
          <div>
            <Label>Brands</Label>
            <div className="space-y-2 mt-2">
              {brands.map((brand, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={brand}
                    onChange={(e) =>
                      handleUpdateField(brands, setBrands, idx, e.target.value)
                    }
                    placeholder="e.g., Carrier, Trane"
                  />
                  {brands.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveField(brands, setBrands, idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddField(brands, setBrands)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Brand
              </Button>
            </div>
          </div>

          {/* Services */}
          <div>
            <Label>Services</Label>
            <div className="space-y-2 mt-2">
              {services.map((service, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={service}
                    onChange={(e) =>
                      handleUpdateField(services, setServices, idx, e.target.value)
                    }
                    placeholder="e.g., Installation, Repair, Maintenance"
                  />
                  {services.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        handleRemoveField(services, setServices, idx)
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddField(services, setServices)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Service
              </Button>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Los Angeles, CA"
            />
          </div>

          {/* Target Market */}
          <div>
            <Label htmlFor="targetMarket">Target Market</Label>
            <select
              id="targetMarket"
              value={targetMarket}
              onChange={(e) =>
                setTargetMarket(
                  e.target.value as "residential" | "commercial" | "both" | "",
                )
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select target market</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Summary */}
          <div>
            <Label htmlFor="summary">Business Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of what this business does..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Business Information"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
