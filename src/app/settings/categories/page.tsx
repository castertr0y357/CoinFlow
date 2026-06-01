import prisma from "@/lib/prisma";
import Card from "@/components/ui/Card";
import CategoryManager from "../CategoryManager";

export default async function CategoriesSettingsPage() {
  const categories = await prisma.category.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ],
    select: { id: true, name: true }
  });

  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>Category Management</h2>
          <p className="text-muted">Add or remove budget categories. Categories with existing transactions cannot be deleted.</p>
          <CategoryManager initialCategories={categories} />
        </div>
      </Card>
    </div>
  );
}
