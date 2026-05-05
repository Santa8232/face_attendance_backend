import 'dart:math';

class FaceMath {
  /// Calculates the cosine similarity between two vectors.
  /// Vectors must be of the same length.
  static double cosineSimilarity(List<dynamic> vecA, List<dynamic> vecB) {
    if (vecA.isEmpty || vecB.isEmpty || vecA.length != vecB.length) return 0.0;
    
    double dotProduct = 0.0;
    double mA = 0.0;
    double mB = 0.0;
    
    for (int i = 0; i < vecA.length; i++) {
      final a = (vecA[i] as num).toDouble();
      final b = (vecB[i] as num).toDouble();
      
      dotProduct += a * b;
      mA += a * a;
      mB += b * b;
    }
    
    if (mA == 0.0 || mB == 0.0) return 0.0;
    
    return dotProduct / (sqrt(mA) * sqrt(mB));
  }
}
